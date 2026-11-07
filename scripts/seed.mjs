import { MongoClient, ObjectId } from "mongodb"
import { validateProduct } from "../lib/product-validation.ts"

const seedVersion = "kalpanika-dev-v1"
const dryRun = process.argv.includes("--dry-run")
const confirmMainDatabase = process.argv.includes("--confirm-main-database")

const categorySeeds = [
  { slug: "desk-essentials", name: "Desk Essentials", description: "Thoughtful organizers and useful objects for a calmer workspace." },
  { slug: "planters", name: "Planters", description: "Small-batch planters shaped for shelves, desks, and sunny corners." },
  { slug: "lighting", name: "Lighting", description: "Sculptural shades and ambient lights for everyday spaces." },
  { slug: "home-decor", name: "Home Decor", description: "Expressive accents and display pieces made for the home." },
  { slug: "wearables", name: "Wearables", description: "Lightweight accessories with playful, considered forms." },
]

const productSeeds = [
  { slug: "arc-pen-tray", category: "desk-essentials", name: "Arc Pen Tray", sku: "KLP-DSK-001", price: 590, stock: 18, status: "Active", featured: true, material: "Matte PLA", dimensions: "18 x 7 x 2 cm", description: "A low-profile tray with a soft arched edge for pens and small desk tools.", ageDays: 12 },
  { slug: "orbit-cable-rest", category: "desk-essentials", name: "Orbit Cable Rest", sku: "KLP-DSK-002", price: 320, stock: 3, status: "Active", featured: false, material: "PLA", dimensions: "5 x 4 x 2 cm", description: "A compact cable guide that keeps charging leads within easy reach.", ageDays: 10 },
  { slug: "stack-modular-caddy", category: "desk-essentials", name: "Stack Modular Caddy", sku: "KLP-DSK-003", price: 1490, stock: 9, status: "Active", featured: true, material: "Matte PLA", dimensions: "16 x 12 x 10 cm", description: "A modular desktop caddy with separated wells for everyday stationery.", ageDays: 8 },
  { slug: "ripple-card-stand", category: "desk-essentials", name: "Ripple Card Stand", sku: "KLP-DSK-004", price: 450, stock: 0, status: "Active", featured: false, material: "PLA", dimensions: "10 x 4 x 3 cm", description: "A ridged display stand for notes, photographs, and small prints.", ageDays: 6 },
  { slug: "column-phone-dock", category: "desk-essentials", name: "Column Phone Dock", sku: "KLP-DSK-005", price: 890, stock: 24, status: "Active", featured: false, material: "Tough PLA", dimensions: "9 x 8 x 7 cm", description: "A stable angled dock with a neat channel for a charging cable.", ageDays: 4 },
  { slug: "grid-monitor-shelf", category: "desk-essentials", name: "Grid Monitor Shelf", sku: "KLP-DSK-006", price: 2290, stock: 6, status: "Inactive", featured: false, material: "Tough PLA", dimensions: "42 x 10 x 5 cm", description: "A raised shelf prototype for freeing up a little space beneath a monitor.", ageDays: 2 },

  { slug: "moss-bud-vase", category: "planters", name: "Moss Bud Vase", sku: "KLP-PLN-001", price: 690, stock: 14, status: "Active", featured: true, material: "Matte PLA", dimensions: "8 x 8 x 12 cm", description: "A small sculptural vessel for dried stems and single cuttings.", ageDays: 18 },
  { slug: "terra-rib-planter", category: "planters", name: "Terra Rib Planter", sku: "KLP-PLN-002", price: 1190, stock: 7, status: "Active", featured: true, material: "PLA", dimensions: "13 x 13 x 12 cm", description: "A softly ribbed planter with a removable drainage insert.", ageDays: 16 },
  { slug: "seedling-window-pot", category: "planters", name: "Seedling Window Pot", sku: "KLP-PLN-003", price: 490, stock: 2, status: "Active", featured: false, material: "PLA", dimensions: "9 x 7 x 8 cm", description: "A compact nursery pot designed for herbs and young window-sill plants.", ageDays: 13 },
  { slug: "arch-hanging-planter", category: "planters", name: "Arch Hanging Planter", sku: "KLP-PLN-004", price: 1590, stock: 11, status: "Active", featured: false, material: "Tough PLA", dimensions: "16 x 16 x 14 cm", description: "A lightweight hanging planter with an integrated loop and clean silhouette.", ageDays: 11 },
  { slug: "pebble-propagation-vase", category: "planters", name: "Pebble Propagation Vase", sku: "KLP-PLN-005", price: 790, stock: 0, status: "Active", featured: false, material: "PLA", dimensions: "10 x 8 x 15 cm", description: "A stable pebble-shaped base holds a clear propagation tube upright.", ageDays: 9 },
  { slug: "terrace-herb-trio", category: "planters", name: "Terrace Herb Trio", sku: "KLP-PLN-006", price: 1890, stock: 5, status: "Inactive", featured: false, material: "Matte PLA", dimensions: "30 x 10 x 9 cm", description: "A prototype three-pot planter for a kitchen sill or narrow balcony ledge.", ageDays: 7 },

  { slug: "halo-tealight-shade", category: "lighting", name: "Halo Tealight Shade", sku: "KLP-LGT-001", price: 990, stock: 12, status: "Active", featured: true, material: "Heat-resistant PLA", dimensions: "12 x 12 x 9 cm", description: "A perforated shade for a battery-operated tealight, casting a gentle pattern.", ageDays: 24 },
  { slug: "fold-table-lamp", category: "lighting", name: "Fold Table Lamp", sku: "KLP-LGT-002", price: 2490, stock: 4, status: "Active", featured: true, material: "PLA", dimensions: "17 x 17 x 22 cm", description: "A folded geometric lamp shell designed for a low-heat LED light source.", ageDays: 21 },
  { slug: "lumen-cord-guide", category: "lighting", name: "Lumen Cord Guide", sku: "KLP-LGT-003", price: 390, stock: 21, status: "Active", featured: false, material: "PLA", dimensions: "6 x 3 x 2 cm", description: "A small wall-mount guide that keeps a lamp cord neatly routed.", ageDays: 19 },
  { slug: "petal-night-light", category: "lighting", name: "Petal Night Light", sku: "KLP-LGT-004", price: 1290, stock: 8, status: "Active", featured: false, material: "Translucent PLA", dimensions: "11 x 11 x 13 cm", description: "A petal-textured cover for a rechargeable, low-heat LED puck light.", ageDays: 17 },
  { slug: "orbit-wall-sconce", category: "lighting", name: "Orbit Wall Sconce", sku: "KLP-LGT-005", price: 2990, stock: 1, status: "Active", featured: false, material: "PLA", dimensions: "20 x 12 x 18 cm", description: "A wall-mounted sculptural shade prototype for LED bulbs only.", ageDays: 15 },
  { slug: "ripple-candle-screen", category: "lighting", name: "Ripple Candle Screen", sku: "KLP-LGT-006", price: 850, stock: 10, status: "Inactive", featured: false, material: "PLA", dimensions: "14 x 14 x 11 cm", description: "A display prototype intended for battery-operated candles, never an open flame.", ageDays: 14 },

  { slug: "soft-arch-bookend", category: "home-decor", name: "Soft Arch Bookend", sku: "KLP-HOM-001", price: 1090, stock: 16, status: "Active", featured: true, material: "Tough PLA", dimensions: "12 x 9 x 14 cm", description: "A weighted-feel arch form for keeping a small stack of books upright.", ageDays: 31 },
  { slug: "still-life-incense-holder", category: "home-decor", name: "Still Life Incense Holder", sku: "KLP-HOM-002", price: 650, stock: 6, status: "Active", featured: false, material: "PLA", dimensions: "20 x 4 x 2 cm", description: "A minimal incense stick holder with a removable ash-catching dish.", ageDays: 29 },
  { slug: "frame-photo-easel", category: "home-decor", name: "Frame Photo Easel", sku: "KLP-HOM-003", price: 490, stock: 19, status: "Active", featured: false, material: "Matte PLA", dimensions: "11 x 8 x 10 cm", description: "A tabletop easel for small photographs, postcards, and art prints.", ageDays: 27 },
  { slug: "wave-catchall-dish", category: "home-decor", name: "Wave Catchall Dish", sku: "KLP-HOM-004", price: 790, stock: 3, status: "Active", featured: true, material: "Matte PLA", dimensions: "15 x 12 x 3 cm", description: "A shallow undulating dish for keys and other small entryway essentials.", ageDays: 25 },
  { slug: "monolith-vase-small", category: "home-decor", name: "Monolith Vase Small", sku: "KLP-HOM-005", price: 1390, stock: 0, status: "Active", featured: false, material: "PLA", dimensions: "10 x 10 x 18 cm", description: "A faceted display vase for dried flowers and decorative stems.", ageDays: 23 },
  { slug: "balance-sculpture", category: "home-decor", name: "Balance Sculpture", sku: "KLP-HOM-006", price: 1790, stock: 7, status: "Inactive", featured: false, material: "Matte PLA", dimensions: "14 x 8 x 19 cm", description: "A desk-scale abstract sculpture exploring stacked curves and negative space.", ageDays: 22 },

  { slug: "petal-earring-pair", category: "wearables", name: "Petal Earring Pair", sku: "KLP-WEA-001", price: 590, stock: 15, status: "Active", featured: true, material: "Lightweight PLA", dimensions: "4 x 3 x 0.4 cm each", description: "A pair of lightweight petal-form earrings with stainless steel hooks.", ageDays: 40 },
  { slug: "loop-key-fob", category: "wearables", name: "Loop Key Fob", sku: "KLP-WEA-002", price: 290, stock: 28, status: "Active", featured: false, material: "PLA", dimensions: "6 x 3 x 1 cm", description: "A tactile loop-shaped key fob with a stainless steel split ring.", ageDays: 38 },
  { slug: "facet-pendant", category: "wearables", name: "Facet Pendant", sku: "KLP-WEA-003", price: 750, stock: 5, status: "Active", featured: true, material: "Lightweight PLA", dimensions: "4 x 4 x 1 cm", description: "A geometric pendant on a simple adjustable cotton cord.", ageDays: 36 },
  { slug: "arc-hair-clip", category: "wearables", name: "Arc Hair Clip", sku: "KLP-WEA-004", price: 390, stock: 2, status: "Active", featured: false, material: "PLA", dimensions: "8 x 3 x 2 cm", description: "A curved hair clip prototype with a spring clasp for light everyday wear.", ageDays: 34 },
  { slug: "stack-ring-set", category: "wearables", name: "Stack Ring Set", sku: "KLP-WEA-005", price: 450, stock: 11, status: "Active", featured: false, material: "Lightweight PLA", dimensions: "Sizes 6-8", description: "A set of three light, stackable statement rings in varied profiles.", ageDays: 32 },
  { slug: "ripple-brooch", category: "wearables", name: "Ripple Brooch", sku: "KLP-WEA-006", price: 520, stock: 0, status: "Inactive", featured: false, material: "PLA", dimensions: "5 x 5 x 1 cm", description: "A textured brooch sample with a locking pin back, held as a draft listing.", ageDays: 30 },
]

const orderSeeds = [
  { suffix: "001", daysAgo: 1, status: "confirmed", paymentStatus: "pending", paymentMethod: "upi", customerIndex: 1, lines: [["arc-pen-tray", 1], ["moss-bud-vase", 1]], shippingCharge: 0, discount: 0 },
  { suffix: "002", daysAgo: 4, status: "processing", paymentStatus: "pending", paymentMethod: "card", customerIndex: 2, lines: [["terra-rib-planter", 1], ["petal-earring-pair", 2]], shippingCharge: 90, discount: 0 },
  { suffix: "003", daysAgo: 12, status: "shipped", paymentStatus: "pending", paymentMethod: "netbanking", customerIndex: 3, lines: [["fold-table-lamp", 1], ["orbit-cable-rest", 1]], shippingCharge: 0, discount: 100 },
  { suffix: "004", daysAgo: 34, status: "delivered", paymentStatus: "pending", paymentMethod: "upi", customerIndex: 1, lines: [["soft-arch-bookend", 2]], shippingCharge: 120, discount: 0 },
  { suffix: "005", daysAgo: 61, status: "cancelled", paymentStatus: "failed", paymentMethod: "card", customerIndex: 4, lines: [["halo-tealight-shade", 1]], shippingCharge: 0, discount: 0 },
  { suffix: "006", daysAgo: 88, status: "confirmed", paymentStatus: "pending", paymentMethod: "upi", customerIndex: 2, lines: [["wave-catchall-dish", 1], ["loop-key-fob", 1], ["frame-photo-easel", 1]], shippingCharge: 0, discount: 50 },
]

const customers = {
  1: { firstName: "Asha", lastName: "Sample", email: "asha.seed@example.invalid", phone: "+910000000001", clerkUserId: "seed-dev-customer-001" },
  2: { firstName: "Kabir", lastName: "Example", email: "kabir.seed@example.invalid", phone: "+910000000002", clerkUserId: "seed-dev-customer-002" },
  3: { firstName: "Mira", lastName: "Fiction", email: "mira.seed@example.invalid", phone: "+910000000003", clerkUserId: "seed-dev-customer-003" },
  4: { firstName: "Dev", lastName: "Sample", email: "dev.seed@example.invalid", phone: "+910000000004", clerkUserId: "seed-dev-customer-004" },
}

function daysAgo(count) {
  const date = new Date()
  date.setDate(date.getDate() - count)
  date.setHours(12, 0, 0, 0)
  return date
}

function assertSeedEnvironment() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed when NODE_ENV=production.")
  }
  if (dryRun) return { databaseName: null, uri: null }

  const databaseName = process.env.MONGODB_DB?.trim()
  const isDevelopmentDatabase = /(?:^|[-_])(dev|development|test|testing)$/i.test(databaseName ?? "")
  if (!databaseName || (!isDevelopmentDatabase && !(confirmMainDatabase && databaseName === "kalpanika"))) {
    throw new Error("Use a database ending in _dev or _test, or explicitly confirm the main kalpanika database.")
  }
  if (process.env.ALLOW_DEV_SEED !== "true") {
    throw new Error("Set ALLOW_DEV_SEED=true to confirm seed writes.")
  }
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new Error("Set DATABASE_URL or MONGODB_URI before seeding.")
  return { databaseName, uri }
}

function createCategoryMap() {
  return new Map(categorySeeds.map((category, index) => [
    category.slug,
    { ...category, _id: new ObjectId((index + 1).toString(16).padStart(24, "0")) },
  ]))
}

function validatedProductSeeds(categoryBySlug) {
  return productSeeds.map((seed) => {
    const category = categoryBySlug.get(seed.category)
    if (!category) throw new Error(`Unknown category for seed product ${seed.slug}.`)
    const validation = validateProduct({
      name: seed.name,
      description: seed.description,
      sku: seed.sku,
      categoryId: category._id.toHexString(),
      price: seed.price,
      stock: seed.stock,
      status: seed.status,
      images: [],
      featured: seed.featured,
      material: seed.material,
      dimensions: seed.dimensions,
      care: "Wipe clean with a soft, dry cloth. Keep away from high heat.",
    })
    if ("error" in validation) throw new Error(`${seed.sku}: ${validation.error}`)
    return {
      ...validation.data,
      slug: seed.slug,
      seedKey: `${seedVersion}:product:${seed.slug}`,
      createdAt: daysAgo(seed.ageDays),
    }
  })
}

function validateOrderSeeds(productsBySlug) {
  for (const seed of orderSeeds) {
    if (!["confirmed", "processing", "shipped", "delivered", "cancelled"].includes(seed.status)) {
      throw new Error(`Unsupported order status in sample order ${seed.suffix}.`)
    }
    if (!["pending", "failed"].includes(seed.paymentStatus)) {
      throw new Error(`Seed orders must not claim successful payment (${seed.suffix}).`)
    }
    const subtotal = seed.lines.reduce((sum, [slug, quantity]) => {
      const product = productsBySlug.get(slug)
      if (!product || !Number.isInteger(quantity) || quantity < 1) {
        throw new Error(`Invalid product line in sample order ${seed.suffix}.`)
      }
      return sum + product.price * quantity
    }, 0)
    if (seed.discount < 0 || seed.discount > subtotal || seed.shippingCharge < 0) {
      throw new Error(`Invalid totals in sample order ${seed.suffix}.`)
    }
  }
}

async function ensureIndexes(database) {
  await Promise.all([
    database.collection("categories").createIndex({ slug: 1 }, { unique: true }),
    database.collection("categories").createIndex(
      { seedKey: 1 },
      { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
    ),
    database.collection("products").createIndex({ slug: 1 }, { unique: true }),
    database.collection("products").createIndex({ sku: 1 }, { unique: true }),
    database.collection("products").createIndex(
      { seedKey: 1 },
      { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
    ),
    database.collection("orders").createIndex({ orderId: 1 }, { unique: true }),
    database.collection("orders").createIndex(
      { idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
    ),
    database.collection("orders").createIndex(
      { seedKey: 1 },
      { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
    ),
  ])
}

async function upsertSeed(collection, seedKey, fields, createdAt) {
  const { _id, createdAt: ignoredCreatedAt, ...setFields } = fields
  const result = await collection.updateOne(
    { seedKey },
    {
      $set: { ...setFields, seedKey, updatedAt: new Date() },
      $setOnInsert: { _id: new ObjectId(), createdAt: createdAt ?? ignoredCreatedAt ?? new Date() },
    },
    { upsert: true },
  )
  return result.upsertedCount ? "created" : "updated"
}

async function main() {
  const { databaseName, uri } = assertSeedEnvironment()
  const categoryBySlug = createCategoryMap()
  const validatedProducts = validatedProductSeeds(categoryBySlug)
  const productBySlug = new Map(validatedProducts.map((product) => [product.slug, product]))
  validateOrderSeeds(productBySlug)

  if (dryRun) {
    console.log(`Dry run passed: ${categorySeeds.length} categories, ${validatedProducts.length} validated products, ${orderSeeds.length} unpaid/failed orders.`)
    console.log("No database connection or writes were made.")
    return
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 })
  try {
    await client.connect()
    const database = client.db(databaseName)
    await ensureIndexes(database)
    const counts = {
      categories: { created: 0, updated: 0 },
      products: { created: 0, updated: 0 },
      orders: { created: 0, updated: 0 },
    }
    const now = new Date()

    for (const [index, category] of categorySeeds.entries()) {
      const key = `${seedVersion}:category:${category.slug}`
      const result = await upsertSeed(database.collection("categories"), key, {
        ...category,
        imageUrl: null,
        active: true,
        priority: index + 1,
      }, now)
      counts.categories[result] += 1
      categoryBySlug.set(category.slug, await database.collection("categories").findOne({ seedKey: key }))
    }

    const productsCollection = database.collection("products")
    for (const seed of productSeeds) {
      const category = categoryBySlug.get(seed.category)
      const validation = validateProduct({
        name: seed.name,
        description: seed.description,
        sku: seed.sku,
        categoryId: category._id.toHexString(),
        price: seed.price,
        stock: seed.stock,
        status: seed.status,
        images: [],
        featured: seed.featured,
        material: seed.material,
        dimensions: seed.dimensions,
        care: "Wipe clean with a soft, dry cloth. Keep away from high heat.",
      })
      if ("error" in validation) throw new Error(`${seed.sku}: ${validation.error}`)
      const key = `${seedVersion}:product:${seed.slug}`
      const result = await upsertSeed(productsCollection, key, {
        ...validation.data,
        slug: seed.slug,
      }, daysAgo(seed.ageDays))
      counts.products[result] += 1
      productBySlug.set(seed.slug, await productsCollection.findOne({ seedKey: key }))
    }

    const ordersCollection = database.collection("orders")
    for (const seed of orderSeeds) {
      const customer = customers[seed.customerIndex]
      const items = seed.lines.map(([slug, quantity]) => {
        const product = productBySlug.get(slug)
        const category = [...categoryBySlug.values()].find((item) => item._id.equals(product.categoryId))
        if (!category) throw new Error(`Missing category snapshot for ${slug}.`)
        return {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          category: category.name,
          sku: product.sku,
          price: product.price,
          quantity,
          image: product.images[0] ?? null,
        }
      })
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const createdAt = daysAgo(seed.daysAgo)
      const key = `${seedVersion}:order:${seed.suffix}`
      const result = await upsertSeed(ordersCollection, key, {
        orderId: `KLP-DEV-${seed.suffix}`,
        idempotencyKey: `seed-dev-order-${seed.suffix}`,
        clerkUserId: customer.clerkUserId,
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
        },
        shipping: {
          address: `Test Address ${seed.customerIndex}`,
          landmark: "Sample building",
          city: "Pune",
          state: "Maharashtra",
          pin: "000000",
          country: "India",
        },
        items,
        subtotal,
        shippingCharge: seed.shippingCharge,
        discount: seed.discount,
        total: subtotal + seed.shippingCharge - seed.discount,
        paymentMethod: seed.paymentMethod,
        paymentStatus: seed.paymentStatus,
        status: seed.status,
        statusHistory: [{ status: seed.status, updatedAt: createdAt, updatedBy: "development-seed" }],
      }, createdAt)
      counts.orders[result] += 1
    }

    console.log(`Seeded development database "${databaseName}" (${seedVersion}).`)
    for (const [collection, result] of Object.entries(counts)) {
      console.log(`${collection}: ${result.created} created, ${result.updated} updated`)
    }
    console.log("No records were deleted; seed orders are pending or failed and no Clerk users were created.")
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(`Development seed failed: ${error instanceof Error ? error.message : "Unknown error."}`)
  process.exitCode = 1
})