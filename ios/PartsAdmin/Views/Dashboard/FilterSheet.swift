import SwiftUI

struct FilterSheet: View {
    @Bindable var vm: PartsListViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                // Status
                Section("Status") {
                    Picker("Status", selection: $vm.statusFilter) {
                        ForEach(StatusFilter.allCases, id: \.self) { status in
                            Text(status.rawValue).tag(status)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                // Sort
                Section("Sort By") {
                    Picker("Field", selection: $vm.sortField) {
                        ForEach(SortField.allCases, id: \.self) { field in
                            Text(field.rawValue).tag(field)
                        }
                    }

                    Toggle("Ascending", isOn: $vm.sortAscending)
                }

                // Make
                Section("Make") {
                    Picker("Make", selection: Binding(
                        get: { vm.makeFilter ?? "" },
                        set: { vm.makeFilter = $0.isEmpty ? nil : $0 }
                    )) {
                        Text("All Makes").tag("")
                        ForEach(vm.availableMakes, id: \.self) { make in
                            Text(make).tag(make)
                        }
                    }
                }

                // Category
                Section("Category") {
                    Picker("Category", selection: Binding(
                        get: { vm.categoryFilter ?? "" },
                        set: { vm.categoryFilter = $0.isEmpty ? nil : $0 }
                    )) {
                        Text("All Categories").tag("")
                        ForEach(Constants.categories) { cat in
                            Text(cat.label).tag(cat.value)
                        }
                    }
                }

                // Reset
                Section {
                    Button("Reset Filters", role: .destructive) {
                        vm.statusFilter = .all
                        vm.makeFilter = nil
                        vm.categoryFilter = nil
                        vm.sortField = .createdAt
                        vm.sortAscending = false
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
