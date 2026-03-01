import SwiftUI

struct PartRowView: View {
    let part: Part
    let isSelected: Bool
    let isSelecting: Bool

    var body: some View {
        HStack(spacing: 12) {
            if isSelecting {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? .blue : .gray)
                    .font(.title3)
            }

            // Photo thumbnail
            AsyncImage(url: part.firstPhotoURL) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Image(systemName: "photo")
                    .font(.title2)
                    .foregroundStyle(.gray)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemGray6))
            }
            .frame(width: 60, height: 60)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(part.name)
                    .font(.subheadline.bold())
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let stockNumber = part.stockNumber {
                        Text("#\(stockNumber)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if !part.vehicleTitle.isEmpty {
                        Text(part.vehicleTitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                HStack(spacing: 6) {
                    ConditionBadge(condition: part.condition)

                    Text(Constants.categoryLabel(for: part.category))
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    if part.quantity > 1 {
                        Text("x\(part.quantity)")
                            .font(.caption2.bold())
                            .foregroundStyle(.orange)
                    }
                }
            }

            Spacer()

            // Price & Status
            VStack(alignment: .trailing, spacing: 4) {
                PriceLabel(price: part.price, isSold: part.isSold)

                if part.isSold {
                    Label("Sold", systemImage: "checkmark.seal.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                }

                HStack(spacing: 4) {
                    if part.isListedOnFB {
                        Image(systemName: "f.square.fill")
                            .font(.caption2)
                            .foregroundStyle(.blue)
                    }
                    if part.isListedOnEbay {
                        Image(systemName: "e.square.fill")
                            .font(.caption2)
                            .foregroundStyle(.red)
                    }
                }
            }
        }
        .padding(.vertical, 4)
        .opacity(part.isSold ? 0.7 : 1)
    }
}
