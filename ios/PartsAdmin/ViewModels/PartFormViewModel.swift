import Foundation
import UIKit
import Observation

@Observable
final class PartFormViewModel {
    // Form fields
    var name = ""
    var category = "other"
    var condition = "good"
    var price = ""
    var quantity = "1"
    var pricePer: PricePer = .lot
    var description = ""
    var serialNumber = ""
    var vin = ""
    var isPublished = true

    // Vehicle info (from VIN)
    var year: String = ""
    var make = ""
    var model = ""
    var bodyClass = ""
    var engineDisplacement = ""
    var engineCylinders = ""
    var engineHp = ""
    var engineTurbo = false
    var driveType = ""
    var fuelType = ""

    // Photos
    var photos: [PhotoItem] = []
    var existingPhotoURLs: [String] = []
    var deletedPhotoURLs: [String] = []

    // State
    var isSaving = false
    var isDecodingVIN = false
    var errorMessage: String?
    var vinDecodeSuccess = false

    // Editing mode
    var editingPartId: String?
    var isEditing: Bool { editingPartId != nil }

    func loadPart(_ part: Part) {
        editingPartId = part.id
        name = part.name
        category = part.category
        condition = part.condition
        price = String(format: "%.2f", part.price)
        quantity = String(part.quantity)
        pricePer = part.pricePer
        description = part.description ?? ""
        serialNumber = part.serialNumber ?? ""
        vin = part.vin ?? ""
        isPublished = part.isPublished
        year = part.year.map { String($0) } ?? ""
        make = part.make ?? ""
        model = part.model ?? ""
        bodyClass = part.bodyClass ?? ""
        engineDisplacement = part.engineDisplacement ?? ""
        engineCylinders = part.engineCylinders.map { String($0) } ?? ""
        engineHp = part.engineHp ?? ""
        engineTurbo = part.engineTurbo
        driveType = part.driveType ?? ""
        fuelType = part.fuelType ?? ""
        existingPhotoURLs = part.photos
    }

    func decodeVIN() async {
        guard vin.count == 17 else {
            errorMessage = "VIN must be 17 characters"
            return
        }

        isDecodingVIN = true
        errorMessage = nil
        vinDecodeSuccess = false

        do {
            let result = try await VINService.shared.decode(vin: vin)
            year = result.year.map { String($0) } ?? year
            make = result.make ?? make
            model = result.model ?? model
            bodyClass = result.bodyClass ?? bodyClass
            engineDisplacement = result.engineDisplacement ?? engineDisplacement
            engineCylinders = result.engineCylinders.map { String($0) } ?? engineCylinders
            engineHp = result.engineHp ?? engineHp
            engineTurbo = result.engineTurbo
            driveType = result.driveType ?? driveType
            fuelType = result.fuelType ?? fuelType
            vinDecodeSuccess = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isDecodingVIN = false
    }

    func addPhotos(_ images: [UIImage]) {
        for image in images {
            photos.append(PhotoItem(image: image))
        }
    }

    func removePhoto(at index: Int) {
        photos.remove(at: index)
    }

    func removeExistingPhoto(at index: Int) {
        let url = existingPhotoURLs.remove(at: index)
        deletedPhotoURLs.append(url)
    }

    func movePhoto(from source: IndexSet, to destination: Int) {
        photos.move(fromOffsets: source, toOffset: destination)
    }

    func moveExistingPhoto(from source: IndexSet, to destination: Int) {
        existingPhotoURLs.move(fromOffsets: source, toOffset: destination)
    }

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (Double(price) ?? 0) >= 0 &&
        (Int(quantity) ?? 0) > 0
    }

    func save() async throws -> Part {
        guard isValid else { throw FormError.invalidInput }

        isSaving = true
        errorMessage = nil

        do {
            // Upload new photos
            var photoURLs = existingPhotoURLs
            for item in photos {
                let url = try await StorageService.shared.uploadPhoto(item.image)
                photoURLs.append(url)
            }

            // Delete removed photos
            for url in deletedPhotoURLs {
                try? await StorageService.shared.deletePhoto(url: url)
            }

            let priceValue = Double(price) ?? 0
            let qtyValue = Int(quantity) ?? 1

            if let partId = editingPartId {
                // Update existing
                var fields: [String: AnyJSON] = [
                    "name": .string(name),
                    "category": .string(category),
                    "condition": .string(condition),
                    "price": .double(priceValue),
                    "quantity": .double(Double(qtyValue)),
                    "price_per": .string(pricePer.rawValue),
                    "description": description.isEmpty ? .null : .string(description),
                    "serial_number": serialNumber.isEmpty ? .null : .string(serialNumber),
                    "vin": vin.isEmpty ? .null : .string(vin),
                    "is_published": .bool(isPublished),
                    "photos": .array(photoURLs.map { .string($0) }),
                    "engine_turbo": .bool(engineTurbo)
                ]

                if !year.isEmpty, let y = Int(year) { fields["year"] = .double(Double(y)) } else { fields["year"] = .null }
                if !make.isEmpty { fields["make"] = .string(make) } else { fields["make"] = .null }
                if !model.isEmpty { fields["model"] = .string(model) } else { fields["model"] = .null }
                if !bodyClass.isEmpty { fields["body_class"] = .string(bodyClass) } else { fields["body_class"] = .null }
                if !engineDisplacement.isEmpty { fields["engine_displacement"] = .string(engineDisplacement) } else { fields["engine_displacement"] = .null }
                if !engineCylinders.isEmpty, let c = Int(engineCylinders) { fields["engine_cylinders"] = .double(Double(c)) } else { fields["engine_cylinders"] = .null }
                if !engineHp.isEmpty { fields["engine_hp"] = .string(engineHp) } else { fields["engine_hp"] = .null }
                if !driveType.isEmpty { fields["drive_type"] = .string(driveType) } else { fields["drive_type"] = .null }
                if !fuelType.isEmpty { fields["fuel_type"] = .string(fuelType) } else { fields["fuel_type"] = .null }

                let part = try await PartsService.shared.update(id: partId, fields: fields)
                isSaving = false
                return part
            } else {
                // Create new
                var insert = PartInsert.empty()
                insert.name = name
                insert.category = category
                insert.condition = condition
                insert.price = priceValue
                insert.quantity = qtyValue
                insert.pricePer = pricePer
                insert.description = description.isEmpty ? nil : description
                insert.serialNumber = serialNumber.isEmpty ? nil : serialNumber
                insert.vin = vin.isEmpty ? nil : vin
                insert.isPublished = isPublished
                insert.photos = photoURLs
                insert.engineTurbo = engineTurbo

                if !year.isEmpty { insert.year = Int(year) }
                if !make.isEmpty { insert.make = make }
                if !model.isEmpty { insert.model = model }
                if !bodyClass.isEmpty { insert.bodyClass = bodyClass }
                if !engineDisplacement.isEmpty { insert.engineDisplacement = engineDisplacement }
                if !engineCylinders.isEmpty { insert.engineCylinders = Int(engineCylinders) }
                if !engineHp.isEmpty { insert.engineHp = engineHp }
                if !driveType.isEmpty { insert.driveType = driveType }
                if !fuelType.isEmpty { insert.fuelType = fuelType }

                let part = try await PartsService.shared.create(insert)
                isSaving = false
                return part
            }
        } catch {
            isSaving = false
            errorMessage = error.localizedDescription
            throw error
        }
    }
}

struct PhotoItem: Identifiable {
    let id = UUID()
    let image: UIImage
}

enum FormError: LocalizedError {
    case invalidInput

    var errorDescription: String? {
        switch self {
        case .invalidInput: return "Please fill in all required fields"
        }
    }
}
