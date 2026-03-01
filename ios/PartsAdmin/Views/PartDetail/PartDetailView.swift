import SwiftUI
import PhotosUI

struct PartDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @State var part: Part
    @State private var isEditing = false
    @State private var vm = PartFormViewModel()
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var showCamera = false
    var onUpdate: ((Part) -> Void)?

    var body: some View {
        NavigationStack {
            if isEditing {
                editView
            } else {
                readView
            }
        }
    }

    // MARK: - Read View

    private var readView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Photos
                if !part.photos.isEmpty {
                    PhotoGalleryView(photoURLs: part.photos)
                }

                VStack(alignment: .leading, spacing: 12) {
                    // Title & Stock
                    HStack {
                        Text(part.name)
                            .font(.title2.bold())
                        Spacer()
                        if let stock = part.stockNumber {
                            Text("#\(stock)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    // Price
                    HStack {
                        PriceLabel(price: part.price, isSold: part.isSold)
                        if part.pricePer == .item {
                            Text("per item")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if part.quantity > 1 {
                            Text("(qty: \(part.quantity))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    // Status badges
                    HStack(spacing: 8) {
                        ConditionBadge(condition: part.condition)

                        Text(Constants.categoryLabel(for: part.category))
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color(.systemGray5))
                            .clipShape(Capsule())

                        if part.isSold {
                            Text("SOLD")
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.green.opacity(0.15))
                                .foregroundStyle(.green)
                                .clipShape(Capsule())
                        }
                    }

                    Divider()

                    // Vehicle info
                    if !part.vehicleTitle.isEmpty {
                        detailRow("Vehicle", part.vehicleTitle)
                    }
                    if let vin = part.vin {
                        detailRow("VIN", vin)
                    }

                    // Engine
                    if let disp = part.engineDisplacement {
                        detailRow("Engine", "\(disp)L\(part.engineTurbo ? " Turbo" : "")")
                    }
                    if let cyl = part.engineCylinders {
                        detailRow("Cylinders", "\(cyl)")
                    }
                    if let hp = part.engineHp {
                        detailRow("Horsepower", "\(hp) HP")
                    }
                    if let drive = part.driveType {
                        detailRow("Drive", drive)
                    }
                    if let fuel = part.fuelType {
                        detailRow("Fuel", fuel)
                    }

                    // Description
                    if let desc = part.description, !desc.isEmpty {
                        Divider()
                        Text("Description")
                            .font(.subheadline.bold())
                        Text(desc)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    // Serial
                    if let serial = part.serialNumber {
                        detailRow("Serial #", serial)
                    }

                    Divider()

                    // Platform status
                    if part.isListedOnFB || part.isListedOnEbay {
                        Text("Listings")
                            .font(.subheadline.bold())
                        if part.isListedOnFB {
                            Label("Facebook Marketplace", systemImage: "f.square.fill")
                                .font(.caption)
                                .foregroundStyle(.blue)
                        }
                        if part.isListedOnEbay {
                            Label("eBay", systemImage: "e.square.fill")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }

                    // Sold info
                    if part.isSold {
                        if let soldPrice = part.soldPrice {
                            detailRow("Sold Price", soldPrice.formattedPrice)
                        }
                        if let soldAt = part.soldAt, let date = Date.fromISO(soldAt) {
                            detailRow("Sold", date.relativeString)
                        }
                    }

                    // Dates
                    if let date = Date.fromISO(part.createdAt) {
                        detailRow("Added", date.relativeString)
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Part Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") {
                    vm.loadPart(part)
                    isEditing = true
                }
            }
        }
    }

    // MARK: - Edit View

    private var editView: some View {
        Form {
            Section("Part Information") {
                TextField("Part Name *", text: $vm.name)

                Picker("Category", selection: $vm.category) {
                    ForEach(Constants.categories) { cat in
                        Text(cat.label).tag(cat.value)
                    }
                }

                Picker("Condition", selection: $vm.condition) {
                    ForEach(Constants.conditions) { cond in
                        Text(cond.label).tag(cond.value)
                    }
                }

                TextField("Serial Number", text: $vm.serialNumber)
            }

            Section("Pricing") {
                HStack {
                    Text("$")
                    TextField("Price", text: $vm.price)
                        .keyboardType(.decimalPad)
                }

                HStack {
                    Text("Quantity")
                    TextField("Qty", text: $vm.quantity)
                        .keyboardType(.numberPad)
                }

                Picker("Price Per", selection: $vm.pricePer) {
                    Text("Lot").tag(PricePer.lot)
                    Text("Item").tag(PricePer.item)
                }
                .pickerStyle(.segmented)
            }

            Section("Vehicle (VIN)") {
                TextField("VIN", text: $vm.vin)
                    .autocapitalization(.allCharacters)

                Button {
                    Task { await vm.decodeVIN() }
                } label: {
                    HStack {
                        if vm.isDecodingVIN { ProgressView().controlSize(.small) }
                        Text("Decode VIN")
                    }
                }
                .disabled(vm.vin.count != 17 || vm.isDecodingVIN)

                HStack {
                    TextField("Year", text: $vm.year).keyboardType(.numberPad).frame(width: 60)
                    TextField("Make", text: $vm.make)
                    TextField("Model", text: $vm.model)
                }
            }

            Section("Description") {
                TextEditor(text: $vm.description)
                    .frame(minHeight: 80)
            }

            // Existing photos
            Section("Current Photos (\(vm.existingPhotoURLs.count))") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(vm.existingPhotoURLs.enumerated()), id: \.offset) { index, url in
                            ZStack(alignment: .topTrailing) {
                                AsyncImage(url: URL(string: url)) { image in
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    ProgressView()
                                }
                                .frame(width: 70, height: 70)
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                                Button { vm.removeExistingPhoto(at: index) } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.white, .red)
                                }
                                .offset(x: 4, y: -4)
                            }
                        }
                    }
                }
            }

            // New photos
            Section("Add Photos (\(vm.photos.count))") {
                HStack {
                    PhotosPicker(selection: $selectedPhotos, maxSelectionCount: 30, matching: .images) {
                        Label("Library", systemImage: "photo")
                    }

                    Button { showCamera = true } label: {
                        Label("Camera", systemImage: "camera")
                    }
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(vm.photos.enumerated()), id: \.element.id) { index, item in
                            ZStack(alignment: .topTrailing) {
                                Image(uiImage: item.image)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 70, height: 70)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))

                                Button { vm.removePhoto(at: index) } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.white, .red)
                                }
                                .offset(x: 4, y: -4)
                            }
                        }
                    }
                }
            }

            Section {
                Toggle("Published", isOn: $vm.isPublished)
            }

            if let error = vm.errorMessage {
                Section {
                    Text(error).foregroundStyle(.red).font(.caption)
                }
            }
        }
        .navigationTitle("Edit Part")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { isEditing = false }
            }

            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        do {
                            let updated = try await vm.save()
                            part = updated
                            onUpdate?(updated)
                            isEditing = false
                        } catch {}
                    }
                } label: {
                    if vm.isSaving { ProgressView() } else { Text("Save").bold() }
                }
                .disabled(!vm.isValid || vm.isSaving)
            }
        }
        .onChange(of: selectedPhotos) {
            Task {
                for item in selectedPhotos {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        vm.addPhotos([image])
                    }
                }
                selectedPhotos = []
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraView { image in vm.addPhotos([image]) }
        }
    }

    // MARK: - Helpers

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline)
        }
    }
}
