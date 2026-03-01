import SwiftUI

struct ConditionBadge: View {
    let condition: String

    var body: some View {
        Text(Constants.conditionLabel(for: condition))
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Constants.conditionColor(for: condition).opacity(0.15))
            .foregroundStyle(Constants.conditionColor(for: condition))
            .clipShape(Capsule())
    }
}

struct PriceLabel: View {
    let price: Double
    let isSold: Bool

    var body: some View {
        Text(price.formattedPrice)
            .font(.headline)
            .foregroundStyle(isSold ? .secondary : .primary)
    }
}
