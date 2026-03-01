import Foundation
import Supabase

final class PartsService {
    static let shared = PartsService()

    private let client = SupabaseService.shared.client
    private let table = "parts"

    private init() {}

    // MARK: - Fetch

    func fetchAll() async throws -> [Part] {
        try await client.from(table)
            .select()
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    func fetchById(_ id: String) async throws -> Part {
        try await client.from(table)
            .select()
            .eq("id", value: id)
            .single()
            .execute()
            .value
    }

    // MARK: - Create

    func create(_ part: PartInsert) async throws -> Part {
        try await client.from(table)
            .insert(part)
            .select()
            .single()
            .execute()
            .value
    }

    // MARK: - Update

    func update(id: String, fields: [String: AnyJSON]) async throws -> Part {
        try await client.from(table)
            .update(fields)
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value
    }

    // MARK: - Delete

    func delete(id: String) async throws {
        try await client.from(table)
            .delete()
            .eq("id", value: id)
            .execute()
    }

    // MARK: - Bulk Operations

    func bulkUpdatePrice(ids: [String], mode: BulkPriceMode, value: Double) async throws {
        let parts: [Part] = try await client.from(table)
            .select()
            .in("id", values: ids)
            .execute()
            .value

        for part in parts {
            let newPrice: Double
            switch mode {
            case .setTo:
                newPrice = value
            case .increaseBy:
                newPrice = part.price + value
            case .decreaseBy:
                newPrice = max(0, part.price - value)
            case .increaseByPercent:
                newPrice = part.price * (1 + value / 100)
            }

            let _ : Part = try await client.from(table)
                .update(["price": AnyJSON(newPrice)])
                .eq("id", value: part.id)
                .select()
                .single()
                .execute()
                .value
        }
    }

    func bulkMarkSold(ids: [String]) async throws {
        let fields: [String: AnyJSON] = [
            "is_sold": .bool(true),
            "is_published": .bool(false),
            "sold_at": .string(ISO8601DateFormatter().string(from: Date())),
            "fb_posted_at": .null,
            "ebay_listing_id": .null,
            "ebay_offer_id": .null,
            "ebay_listing_url": .null,
            "ebay_listed_at": .null
        ]

        for id in ids {
            let _: Part = try await client.from(table)
                .update(fields)
                .eq("id", value: id)
                .select()
                .single()
                .execute()
                .value
        }
    }

    func bulkMarkAvailable(ids: [String]) async throws {
        let fields: [String: AnyJSON] = [
            "is_sold": .bool(false),
            "is_published": .bool(true),
            "sold_price": .null,
            "sold_at": .null
        ]

        for id in ids {
            let _: Part = try await client.from(table)
                .update(fields)
                .eq("id", value: id)
                .select()
                .single()
                .execute()
                .value
        }
    }

    func bulkDelete(ids: [String]) async throws {
        for id in ids {
            // Delete photos from storage first
            let part: Part = try await client.from(table)
                .select()
                .eq("id", value: id)
                .single()
                .execute()
                .value

            for photoURL in part.photos {
                try? await StorageService.shared.deletePhoto(url: photoURL)
            }

            try await client.from(table)
                .delete()
                .eq("id", value: id)
                .execute()
        }
    }

    // MARK: - Sell

    func sellPart(id: String, soldPrice: Double) async throws -> Part {
        let fields: [String: AnyJSON] = [
            "is_sold": .bool(true),
            "is_published": .bool(false),
            "sold_price": .double(soldPrice),
            "sold_at": .string(ISO8601DateFormatter().string(from: Date())),
            "fb_posted_at": .null,
            "ebay_listing_id": .null,
            "ebay_offer_id": .null,
            "ebay_listing_url": .null,
            "ebay_listed_at": .null
        ]

        return try await client.from(table)
            .update(fields)
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value
    }

    func sellPartialQuantity(id: String, soldQty: Int, soldPrice: Double) async throws {
        let part: Part = try await client.from(table)
            .select()
            .eq("id", value: id)
            .single()
            .execute()
            .value

        let remainingQty = part.quantity - soldQty

        // Create sold record
        var soldPart = PartInsert.empty()
        soldPart.name = part.name
        soldPart.vin = part.vin
        soldPart.year = part.year
        soldPart.make = part.make
        soldPart.model = part.model
        soldPart.description = part.description
        soldPart.serialNumber = part.serialNumber
        soldPart.category = part.category
        soldPart.condition = part.condition
        soldPart.quantity = soldQty
        soldPart.price = soldPrice
        soldPart.pricePer = .lot
        soldPart.photos = part.photos
        soldPart.isPublished = false
        soldPart.isSold = true
        soldPart.soldPrice = soldPrice
        soldPart.soldAt = ISO8601DateFormatter().string(from: Date())
        soldPart.bodyClass = part.bodyClass
        soldPart.engineDisplacement = part.engineDisplacement
        soldPart.engineCylinders = part.engineCylinders
        soldPart.engineHp = part.engineHp
        soldPart.engineTurbo = part.engineTurbo
        soldPart.driveType = part.driveType
        soldPart.fuelType = part.fuelType

        let _: Part = try await client.from(table)
            .insert(soldPart)
            .select()
            .single()
            .execute()
            .value

        // Update original with remaining qty
        var updateFields: [String: AnyJSON] = [
            "quantity": .double(Double(remainingQty))
        ]
        if part.pricePer == .lot {
            let pricePerUnit = part.price / Double(part.quantity)
            updateFields["price"] = .double(pricePerUnit * Double(remainingQty))
        }

        let _: Part = try await client.from(table)
            .update(updateFields)
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value
    }

    func unsellPart(id: String) async throws -> Part {
        let fields: [String: AnyJSON] = [
            "is_sold": .bool(false),
            "is_published": .bool(true),
            "sold_price": .null,
            "sold_at": .null
        ]

        return try await client.from(table)
            .update(fields)
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value
    }

    // MARK: - Delist

    func delistFromFB(id: String) async throws -> Part {
        try await client.from(table)
            .update(["fb_posted_at": AnyJSON.null])
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value
    }

    func delistFromEbay(id: String) async throws -> Part {
        let fields: [String: AnyJSON] = [
            "ebay_listing_id": .null,
            "ebay_offer_id": .null,
            "ebay_listing_url": .null,
            "ebay_listed_at": .null
        ]
        return try await client.from(table)
            .update(fields)
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value
    }
}

enum BulkPriceMode {
    case setTo
    case increaseBy
    case decreaseBy
    case increaseByPercent
}
