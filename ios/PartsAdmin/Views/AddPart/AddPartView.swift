import SwiftUI
import PhotosUI

struct AddPartView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var vm = PartFormViewModel()
    @State private var showPhotoPicker = false
    @State private var showCamera = false
    @State private var showVINScanner = false
    @State private var selectedPhotos: [PhotosPickerItem] = []
    var onSave: ((Part) -> Void)?

    var body: some View {
        NavigationStack {
            Form {
                // MARK: - Basic Info
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

                // MARK: - Pricing
                Section("Pricing") {
                    HStack {
                        Text("$")
                        TextField("Price *", text: $vm.price)
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

                // MARK: - VIN
                Section("Vehicle (VIN)") {
                    HStack {
                        TextField("VIN (17 characters)", text: $vm.vin)
                            .autocapitalization(.allCharacters)

                        Button {
                            showVINScanner = true
                        } label: {
                            Image(systemName: "camera.viewfinder")
                        }
                    }

                    Button {
                        Task { await vm.decodeVIN() }
                    } label: {
                        HStack {
                            if vm.isDecodingVIN {
                                ProgressView()
                                    .controlSize(.small)
                            }
                            Text("Decode VIN")
                        }
                    }
                    .disabled(vm.vin.count != 17 || vm.isDecodingVIN)

                    if vm.vinDecodeSuccess {
                        Label("VIN decoded successfully", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.caption)
                    }

                    if !vm.year.isEmpty || !vm.make.isEmpty || !vm.model.isEmpty {
                        HStack {
                            TextField("Year", text: $vm.year)
                                .keyboardType(.numberPad)
                                .frame(width: 60)
                            TextField("Make", text: $vm.make)
                            TextField("Model", text: $vm.model)
                        }
                    }
                }

                // MARK: - Engine Details
                if !vm.engineDisplacement.isEmpty || !vm.driveType.isEmpty || vm.vinDecodeSuccess {
                    Section("Engine & Drivetrain") {
                        if !vm.engineDisplacement.isEmpty {
                            LabeledContent("Displacement", value: "\(vm.engineDisplacement)L")
                        }
                        if !vm.engineCylinders.isEmpty {
                            LabeledContent("Cylinders", value: vm.engineCylinders)
                        }
                        if !vm.engineHp.isEmpty {
                            LabeledContent("Horsepower", value: "\(vm.engineHp) HP")
                        }
                        if vm.engineTurbo {
                            LabeledContent("Turbo", value: "Yes")
                        }
                        if !vm.driveType.isEmpty {
                            LabeledContent("Drive Type", value: vm.driveType)
                        }
                        if !vm.fuelType.isEmpty {
                            LabeledContent("Fuel", value: vm.fuelType)
                        }
                        if !vm.bodyClass.isEmpty {
                            LabeledContent("Body", value: vm.bodyClass)
                        }
                    }
                }

                // MARK: - Description
                Section("Description") {
                    TextEditor(text: $vm.description)
                        .frame(minHeight: 80)
                }

                // MARK: - Photos
                Section("Photos (\(vm.photos.count))") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            // Add buttons
                            PhotosPicker(selection: $selectedPhotos, maxSelectionCount: 30, matching: .images) {
                                VStack {
                                    Image(systemName: "photo.on.rectangle.angled")
                                        .font(.title2)
                                    Text("Library")
                                        .font(.caption2)
                                }
                                .frame(width: 70, height: 70)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            Button {
                                showCamera = true
                            } label: {
                                VStack {
                                    Image(systemName: "camera")
                                        .font(.title2)
                                    Text("Camera")
                                        .font(.caption2)
                                }
                                .frame(width: 70, height: 70)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            // Photo thumbnails
                            ForEach(Array(vm.photos.enumerated()), id: \.element.id) { index, item in
                                ZStack(alignment: .topTrailing) {
                                    Image(uiImage: item.image)
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 70, height: 70)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))

                                    Button {
                                        vm.removePhoto(at: index)
                                    } label: {
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

                // MARK: - Settings
                Section {
                    Toggle("Published", isOn: $vm.isPublished)
                }

                // MARK: - Error
                if let error = vm.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Add Part")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            do {
                                let part = try await vm.save()
                                onSave?(part)
                                dismiss()
                            } catch {
                                // Error handled in VM
                            }
                        }
                    } label: {
                        if vm.isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                                .bold()
                        }
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
                CameraView { image in
                    vm.addPhotos([image])
                }
            }
            .fullScreenCover(isPresented: $showVINScanner) {
                VINScannerView { vin in
                    vm.vin = vin
                    Task { await vm.decodeVIN() }
                }
            }
        }
    }
}
