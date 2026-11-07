import { MongoClient, ObjectId } from "mongodb"

const version = "kalpanika-user-arrays-v1"
const args = new Set(process.argv.slice(2))
const dryRun = args.has("--dry-run")
const apply = args.has("--apply")
const confirmCutover = args.has("--confirm-cutover")
const confirmMainDatabase = args.has("--confirm-main-database")
const cartStageName = "carts_migration_v1"
const cartBackupName = "carts_legacy_per_product_v1"
const wishlistStageName = "wishlists_migration_v1"
const wishlistBackupName = "wishlists_legacy_v1"

function assertEnvironment() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing data migration when NODE_ENV=production.")
  if (!dryRun && !apply) throw new Error("Use --dry-run or --apply.")
  if (confirmCutover && !apply) throw new Error("--confirm-cutover requires --apply.")
  if (apply && process.env.ALLOW_DATA_MIGRATION !== "true") {
    throw new Error("Set ALLOW_DATA_MIGRATION=true to allow migration writes.")
  }
  const databaseName = process.env.MONGODB_DB?.trim()
  const isDevelopmentDatabase = /(?:^|[-_])(dev|development|test|testing)$/i.test(databaseName ?? "")
  if (!databaseName || (!isDevelopmentDatabase && !(confirmMainDatabase && databaseName === "kalpanika"))) {
    throw new Error("Use a database ending in _dev or _test, or pass --confirm-main-database for kalpanika.")
  }
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new Error("Set DATABASE_URL or MONGODB_URI.")
  return { databaseName, uri }
}

function asObjectId(value, context) {
  if (value instanceof ObjectId) return value
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value)
  throw new Error(`Invalid product ID in ${context}.`)
}

function validDate(value, fallback) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : fallback
}

function getOrCreate(map, clerkUserId, createdAt, updatedAt) {
  if (typeof clerkUserId !== "string" || !clerkUserId) throw new Error("Found a cart or wishlist record without clerkUserId.")
  let user = map.get(clerkUserId)
  if (!user) {
    user = { clerkUserId, items: new Map(), createdAt, updatedAt }
    map.set(clerkUserId, user)
  } else {
    if (createdAt < user.createdAt) user.createdAt = createdAt
    if (updatedAt > user.updatedAt) user.updatedAt = updatedAt
  }
  return user
}

function collectCarts(documents) {
  const now = new Date()
  const users = new Map()
  for (const document of documents) {
    const createdAt = validDate(document.createdAt, now)
    const updatedAt = validDate(document.updatedAt, createdAt)
    const user = getOrCreate(users, document.clerkUserId, createdAt, updatedAt)
    const sourceItems = Array.isArray(document.items)
      ? document.items
      : document.productId ? [{ productId: document.productId, quantity: document.quantity, addedAt: document.createdAt }] : null
    if (!sourceItems) throw new Error(`Unsupported cart record shape for ${document.clerkUserId}.`)

    for (const item of sourceItems) {
      const productId = asObjectId(item.productId, `cart ${document.clerkUserId}`)
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error(`Invalid legacy cart quantity for ${document.clerkUserId}.`)
      }
      const key = productId.toString()
      const addedAt = validDate(item.addedAt, createdAt)
      const existing = user.items.get(key)
      user.items.set(key, {
        productId,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        addedAt: existing && existing.addedAt < addedAt ? existing.addedAt : addedAt,
      })
    }
  }
  return users
}

async function collectWishlists(database, wishlistDocuments) {
  const users = new Map()
  const now = new Date()
  const legacyUsers = await database.collection("users").find({ wishlist: { $type: "array" } }).toArray()
  const legacySlugs = [...new Set(legacyUsers.flatMap((user) => user.wishlist.filter((slug) => typeof slug === "string")))]
  const products = legacySlugs.length
    ? await database.collection("products").find({ slug: { $in: legacySlugs } }, { projection: { _id: 1, slug: 1 } }).toArray()
    : []
  const productsBySlug = new Map(products.map((product) => [product.slug, product._id]))
  let unresolvedSlugs = 0

  for (const userDocument of legacyUsers) {
    const updatedAt = validDate(userDocument.updatedAt, now)
    const user = getOrCreate(users, userDocument.clerkUserId, updatedAt, updatedAt)
    for (const slug of userDocument.wishlist) {
      if (typeof slug !== "string") continue
      const productId = productsBySlug.get(slug)
      if (!productId) {
        unresolvedSlugs += 1
        continue
      }
      user.items.set(productId.toString(), { productId, addedAt: updatedAt })
    }
  }

  for (const document of wishlistDocuments) {
    const createdAt = validDate(document.createdAt, now)
    const updatedAt = validDate(document.updatedAt, createdAt)
    const user = getOrCreate(users, document.clerkUserId, createdAt, updatedAt)
    const sourceItems = Array.isArray(document.items)
      ? document.items
      : document.productId ? [{ productId: document.productId, addedAt: document.createdAt }] : null
    if (!sourceItems) throw new Error(`Unsupported wishlist record shape for ${document.clerkUserId}.`)
    for (const item of sourceItems) {
      const productId = asObjectId(item.productId, `wishlist ${document.clerkUserId}`)
      const key = productId.toString()
      const addedAt = validDate(item.addedAt, createdAt)
      const existing = user.items.get(key)
      user.items.set(key, {
        productId,
        addedAt: existing && existing.addedAt < addedAt ? existing.addedAt : addedAt,
      })
    }
  }
  return { users, unresolvedSlugs }
}

function toCartDocument(user, migrationVersion) {
  return {
    clerkUserId: user.clerkUserId,
    items: [...user.items.values()].sort((first, second) => first.productId.toString().localeCompare(second.productId.toString())),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    migrationVersion,
  }
}

function toWishlistDocument(user, migrationVersion) {
  return {
    clerkUserId: user.clerkUserId,
    items: [...user.items.values()].sort((first, second) => first.productId.toString().localeCompare(second.productId.toString())),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    migrationVersion,
  }
}

function verifyGroups(expected, actual, label) {
  const actualByUser = new Map(actual.map((document) => [document.clerkUserId, document]))
  if (actualByUser.size !== expected.size) throw new Error(`${label} verification failed: user count differs.`)
  for (const [clerkUserId, expectedUser] of expected) {
    const actualUser = actualByUser.get(clerkUserId)
    if (!actualUser || !Array.isArray(actualUser.items)) throw new Error(`${label} verification failed for ${clerkUserId}.`)
    if (actualUser.createdAt?.getTime() !== expectedUser.createdAt.getTime()
      || actualUser.updatedAt?.getTime() !== expectedUser.updatedAt.getTime()) {
      throw new Error(`${label} verification failed for ${clerkUserId}: document timestamps differ.`)
    }
    const actualItems = new Map(actualUser.items.map((item) => [item.productId.toString(), item]))
    if (actualItems.size !== expectedUser.items.size) throw new Error(`${label} verification failed for ${clerkUserId}: item count differs.`)
    for (const [productId, expectedItem] of expectedUser.items) {
      const actualItem = actualItems.get(productId)
      if (actualItem?.quantity !== expectedItem.quantity
        || actualItem?.addedAt?.getTime() !== expectedItem.addedAt.getTime()) {
        throw new Error(`${label} verification failed for ${clerkUserId}: quantity differs for ${productId}.`)
      }
    }
  }
}

async function stageDocuments(database, collectionName, groups, transform) {
  const collectionNames = new Set(await database.listCollections({}, { nameOnly: true }).map((item) => item.name).toArray())
  const stage = database.collection(collectionName)
  if (collectionNames.has(collectionName)) {
    const existing = await stage.find({}).toArray()
    if (existing.some((document) => document.migrationVersion !== version)) {
      throw new Error(`Refusing to overwrite unmarked data in ${collectionName}.`)
    }
    await stage.deleteMany({ migrationVersion: version })
  }
  await stage.createIndex({ clerkUserId: 1 }, { unique: true })
  const documents = [...groups.values()].map((user) => transform(user, version))
  if (documents.length) {
    await stage.bulkWrite(documents.map((document) => ({
      replaceOne: {
        filter: { clerkUserId: document.clerkUserId },
        replacement: { _id: new ObjectId(), ...document },
        upsert: true,
      },
    })), { ordered: true })
  }
  const staged = await stage.find({ migrationVersion: version }).toArray()
  verifyGroups(groups, staged, collectionName)
  return { stage, staged }
}

async function verifyCutoverCollection(collection, label) {
  const documents = await collection.find({}).toArray()
  const owners = new Set()
  for (const document of documents) {
    if (typeof document.clerkUserId !== "string" || owners.has(document.clerkUserId) || !Array.isArray(document.items)) {
      throw new Error(`${label} cutover verification failed: expected one array document per Clerk user.`)
    }
    owners.add(document.clerkUserId)
    const productIds = document.items.map((item) => item.productId.toString())
    if (new Set(productIds).size !== productIds.length) throw new Error(`${label} contains duplicate product IDs.`)
  }
}

async function containsArrayDocuments(database, collectionName) {
  const documents = await database.collection(collectionName).find({}).toArray()
  return documents.length > 0 && documents.every((document) =>
    typeof document.clerkUserId === "string" && Array.isArray(document.items) && !("productId" in document),
  )
}

async function cutoverCart(database, stage) {
  const names = new Set(await database.listCollections({}, { nameOnly: true }).map((item) => item.name).toArray())
  if (names.has(cartBackupName) && names.has("carts")) {
    await verifyCutoverCollection(database.collection("carts"), "Cart")
    await database.collection("carts").createIndex({ clerkUserId: 1 }, { unique: true })
    await database.collection("carts").updateMany({ migrationVersion: version }, { $unset: { migrationVersion: "" } })
    return "already-cut-over"
  }
  if (names.has(cartBackupName) && !names.has("carts")) {
    await database.collection(cartStageName).rename("carts")
  } else {
    if (names.has("carts")) await database.collection("carts").rename(cartBackupName)
    await stage.rename("carts")
  }
  const carts = database.collection("carts")
  await carts.createIndex({ clerkUserId: 1 }, { unique: true })
  await carts.updateMany({ migrationVersion: version }, { $unset: { migrationVersion: "" } })
  await verifyCutoverCollection(carts, "Cart")
  return "cut-over; legacy rows retained in carts_legacy_per_product_v1"
}

async function cutoverWishlist(database, stage) {
  const names = new Set(await database.listCollections({}, { nameOnly: true }).map((item) => item.name).toArray())
  if (names.has(wishlistBackupName) && names.has("wishlists")) {
    await verifyCutoverCollection(database.collection("wishlists"), "Wishlist")
    await database.collection("wishlists").createIndex({ clerkUserId: 1 }, { unique: true })
    await database.collection("wishlists").updateMany({ migrationVersion: version }, { $unset: { migrationVersion: "" } })
    return "already-cut-over"
  }
  if (names.has(wishlistBackupName) && !names.has("wishlists")) {
    await database.collection(wishlistStageName).rename("wishlists")
  } else {
    if (names.has("wishlists")) await database.collection("wishlists").rename(wishlistBackupName)
    await stage.rename("wishlists")
  }
  const wishlists = database.collection("wishlists")
  await wishlists.createIndex({ clerkUserId: 1 }, { unique: true })
  await wishlists.updateMany({ migrationVersion: version }, { $unset: { migrationVersion: "" } })
  await verifyCutoverCollection(wishlists, "Wishlist")
  return "cut-over; any legacy collection retained as wishlists_legacy_v1"
}

async function main() {
  const { databaseName, uri } = assertEnvironment()
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 })
  await client.connect()
  try {
    const database = client.db(databaseName)
    const names = new Set(await database.listCollections({}, { nameOnly: true }).map((item) => item.name).toArray())
    const cartsAlreadyCutOver = names.has("carts") && (
      names.has(cartBackupName) || await containsArrayDocuments(database, "carts")
    )
    const wishlistsAlreadyCutOver = names.has("wishlists") && (
      names.has(wishlistBackupName) || await containsArrayDocuments(database, "wishlists")
    )

    let cartGroups = new Map()
    let cartStage = null
    if (cartsAlreadyCutOver) {
      await verifyCutoverCollection(database.collection("carts"), "Cart")
      await database.collection("carts").updateMany({ migrationVersion: version }, { $unset: { migrationVersion: "" } })
    } else {
      const sourceName = names.has("carts") ? "carts" : names.has(cartBackupName) ? cartBackupName : null
      const source = sourceName ? await database.collection(sourceName).find({}).toArray() : []
      cartGroups = collectCarts(source)
    }

    let wishlistGroups = new Map()
    let unresolvedSlugs = 0
    let wishlistStage = null
    if (wishlistsAlreadyCutOver) {
      await verifyCutoverCollection(database.collection("wishlists"), "Wishlist")
      await database.collection("wishlists").updateMany({ migrationVersion: version }, { $unset: { migrationVersion: "" } })
    } else {
      const sourceName = names.has("wishlists") ? "wishlists" : names.has(wishlistBackupName) ? wishlistBackupName : null
      const source = sourceName ? await database.collection(sourceName).find({}).toArray() : []
      const collected = await collectWishlists(database, source)
      wishlistGroups = collected.users
      unresolvedSlugs = collected.unresolvedSlugs
    }

    console.log(`Database: ${databaseName}`)
    console.log(`Cart users to migrate: ${cartsAlreadyCutOver ? "already cut over" : cartGroups.size}`)
    console.log(`Wishlist users to migrate: ${wishlistsAlreadyCutOver ? "already cut over" : wishlistGroups.size}`)
    console.log(`Unresolved legacy wishlist slugs retained in users: ${unresolvedSlugs}`)
    if (dryRun) {
      console.log("Dry run only. No database changes were made.")
      return
    }

    if (!cartsAlreadyCutOver) {
      const result = await stageDocuments(database, cartStageName, cartGroups, toCartDocument)
      cartStage = result.stage
      console.log(`Staged and verified ${result.staged.length} cart documents.`)
    }
    if (!wishlistsAlreadyCutOver) {
      const result = await stageDocuments(database, wishlistStageName, wishlistGroups, toWishlistDocument)
      wishlistStage = result.stage
      console.log(`Staged and verified ${result.staged.length} wishlist documents.`)
    }

    if (!confirmCutover) {
      console.log("Staging is complete. Review the counts, then rerun with --apply --confirm-cutover to activate it.")
      return
    }

    if (!cartsAlreadyCutOver) console.log(`Cart ${await cutoverCart(database, cartStage)}.`)
    if (!wishlistsAlreadyCutOver) console.log(`Wishlist ${await cutoverWishlist(database, wishlistStage)}.`)
    console.log("Legacy cart rows and users.wishlist fields were retained; no historical source data was deleted.")
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(`User data migration failed: ${error instanceof Error ? error.message : "Unknown error."}`)
  process.exitCode = 1
})
