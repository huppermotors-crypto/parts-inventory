import Foundation

struct PriceRule: Codable, Identifiable {
    let id: String
    var type: RuleType
    var scope: RuleScope
    var scopeValue: String?
    var amount: Double
    var amountType: AmountType
    var isActive: Bool
    let createdAt: String
    let updatedAt: String

    enum RuleType: String, Codable {
        case discount
        case markup
    }

    enum RuleScope: String, Codable {
        case all, make, model, vin, part
    }

    enum AmountType: String, Codable, CaseIterable {
        case percent
        case fixed
    }

    enum CodingKeys: String, CodingKey {
        case id, type, scope
        case scopeValue = "scope_value"
        case amount
        case amountType = "amount_type"
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
