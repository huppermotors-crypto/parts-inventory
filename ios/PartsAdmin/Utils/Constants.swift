import SwiftUI

enum Constants {
    struct CategoryItem: Identifiable {
        let id: String
        let value: String
        let label: String

        init(value: String, label: String) {
            self.id = value
            self.value = value
            self.label = label
        }
    }

    struct ConditionItem: Identifiable {
        let id: String
        let value: String
        let label: String

        init(value: String, label: String) {
            self.id = value
            self.value = value
            self.label = label
        }
    }

    static let categories: [CategoryItem] = [
        CategoryItem(value: "airbags", label: "Airbags"),
        CategoryItem(value: "wheels_tires", label: "Wheels & Tires"),
        CategoryItem(value: "radiator_cooling", label: "Radiator & Cooling"),
        CategoryItem(value: "engine", label: "Engine"),
        CategoryItem(value: "transmission", label: "Transmission"),
        CategoryItem(value: "brakes", label: "Brakes"),
        CategoryItem(value: "suspension", label: "Suspension"),
        CategoryItem(value: "exhaust", label: "Exhaust"),
        CategoryItem(value: "electrical", label: "Electrical"),
        CategoryItem(value: "lighting", label: "Lighting"),
        CategoryItem(value: "body_panels", label: "Body Panels"),
        CategoryItem(value: "bumpers", label: "Bumpers"),
        CategoryItem(value: "mirrors", label: "Mirrors"),
        CategoryItem(value: "glass", label: "Glass"),
        CategoryItem(value: "interior", label: "Interior"),
        CategoryItem(value: "seats", label: "Seats"),
        CategoryItem(value: "steering", label: "Steering"),
        CategoryItem(value: "fuel_system", label: "Fuel System"),
        CategoryItem(value: "ac_heating", label: "A/C & Heating"),
        CategoryItem(value: "electronics_ecu", label: "ECU & Electronics"),
        CategoryItem(value: "sensors", label: "Sensors"),
        CategoryItem(value: "other", label: "Other"),
    ]

    static let conditions: [ConditionItem] = [
        ConditionItem(value: "new", label: "New"),
        ConditionItem(value: "like_new", label: "Like New"),
        ConditionItem(value: "excellent", label: "Excellent"),
        ConditionItem(value: "good", label: "Good"),
        ConditionItem(value: "fair", label: "Fair"),
        ConditionItem(value: "used", label: "Used"),
        ConditionItem(value: "for_parts", label: "For Parts"),
    ]

    static func categoryLabel(for value: String) -> String {
        categories.first { $0.value == value }?.label ?? value
    }

    static func conditionLabel(for value: String) -> String {
        conditions.first { $0.value == value }?.label ?? value
    }

    static func conditionColor(for value: String) -> Color {
        switch value {
        case "new": return .green
        case "like_new": return .mint
        case "excellent": return .teal
        case "good": return .blue
        case "fair": return .orange
        case "used": return .gray
        case "for_parts": return .red
        default: return .gray
        }
    }
}
