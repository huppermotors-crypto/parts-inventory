import Foundation

enum PricePer: String, Codable, CaseIterable {
    case lot
    case item
}

struct Part: Codable, Identifiable, Equatable {
    let id: String
    let createdAt: String
    let updatedAt: String
    var stockNumber: String?
    var vin: String?
    var year: Int?
    var make: String?
    var model: String?
    var name: String
    var description: String?
    var serialNumber: String?
    var price: Double
    var condition: String
    var category: String
    var quantity: Int
    var pricePer: PricePer
    var photos: [String]
    var isPublished: Bool
    var isSold: Bool
    var soldPrice: Double?
    var soldAt: String?
    var bodyClass: String?
    var engineDisplacement: String?
    var engineCylinders: Int?
    var engineHp: String?
    var engineTurbo: Bool
    var driveType: String?
    var fuelType: String?
    var fbPostedAt: String?
    var ebayListingId: String?
    var ebayOfferId: String?
    var ebayListingUrl: String?
    var ebayListedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case stockNumber = "stock_number"
        case vin, year, make, model, name, description
        case serialNumber = "serial_number"
        case price, condition, category, quantity
        case pricePer = "price_per"
        case photos
        case isPublished = "is_published"
        case isSold = "is_sold"
        case soldPrice = "sold_price"
        case soldAt = "sold_at"
        case bodyClass = "body_class"
        case engineDisplacement = "engine_displacement"
        case engineCylinders = "engine_cylinders"
        case engineHp = "engine_hp"
        case engineTurbo = "engine_turbo"
        case driveType = "drive_type"
        case fuelType = "fuel_type"
        case fbPostedAt = "fb_posted_at"
        case ebayListingId = "ebay_listing_id"
        case ebayOfferId = "ebay_offer_id"
        case ebayListingUrl = "ebay_listing_url"
        case ebayListedAt = "ebay_listed_at"
    }

    var lotPrice: Double {
        pricePer == .lot ? price : price * Double(quantity)
    }

    var itemPrice: Double {
        pricePer == .item ? price : (quantity > 0 ? price / Double(quantity) : price)
    }

    var formattedPrice: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: price)) ?? "$\(price)"
    }

    var firstPhotoURL: URL? {
        guard let first = photos.first else { return nil }
        return URL(string: first)
    }

    var vehicleTitle: String {
        [year.map { String($0) }, make, model]
            .compactMap { $0 }
            .joined(separator: " ")
    }

    var isListedOnFB: Bool { fbPostedAt != nil }
    var isListedOnEbay: Bool { ebayListingId != nil }
}

struct PartInsert: Codable {
    var vin: String?
    var year: Int?
    var make: String?
    var model: String?
    var name: String
    var description: String?
    var serialNumber: String?
    var price: Double
    var condition: String
    var category: String
    var quantity: Int
    var pricePer: PricePer
    var photos: [String]
    var isPublished: Bool
    var isSold: Bool
    var soldPrice: Double?
    var soldAt: String?
    var bodyClass: String?
    var engineDisplacement: String?
    var engineCylinders: Int?
    var engineHp: String?
    var engineTurbo: Bool
    var driveType: String?
    var fuelType: String?

    enum CodingKeys: String, CodingKey {
        case vin, year, make, model, name, description
        case serialNumber = "serial_number"
        case price, condition, category, quantity
        case pricePer = "price_per"
        case photos
        case isPublished = "is_published"
        case isSold = "is_sold"
        case soldPrice = "sold_price"
        case soldAt = "sold_at"
        case bodyClass = "body_class"
        case engineDisplacement = "engine_displacement"
        case engineCylinders = "engine_cylinders"
        case engineHp = "engine_hp"
        case engineTurbo = "engine_turbo"
        case driveType = "drive_type"
        case fuelType = "fuel_type"
    }

    static func empty() -> PartInsert {
        PartInsert(
            name: "",
            price: 0,
            condition: "good",
            category: "other",
            quantity: 1,
            pricePer: .lot,
            photos: [],
            isPublished: true,
            isSold: false,
            engineTurbo: false
        )
    }
}
