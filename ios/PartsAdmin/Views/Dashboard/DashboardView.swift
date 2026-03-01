import SwiftUI

struct DashboardView: View {
    @Bindable var vm: PartsListViewModel
    @State private var showFilters = false
    @State private var showAddPart = false
    @State private var selectedPart: Part?
    @State private var partToSell: Part?
    @State private var partToDelete: Part?
    @State private var sellPrice = ""
    @State private var showBulkActions = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Stats bar
                statsBar

                // List
                if vm.isLoading && vm.parts.isEmpty {
                    Spacer()
                    ProgressView("Loading parts...")
                    Spacer()
                } else if vm.filteredParts.isEmpty {
                    Spacer()
                    ContentUnavailableView(
                        "No Parts Found",
                        systemImage: "magnifyingglass",
                        description: Text("Try adjusting your filters or search")
                    )
                    Spacer()
                } else {
                    partsList
                }
            }
            .navigationTitle("Inventory")
            .searchable(text: $vm.searchText, prompt: "Search parts...")
            .refreshable { await vm.loadParts() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        withAnimation { vm.isSelecting.toggle() }
                        if !vm.isSelecting { vm.clearSelection() }
                    } label: {
                        Text(vm.isSelecting ? "Cancel" : "Select")
                    }
                }

                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showFilters = true } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }

                    Button { showAddPart = true } label: {
                        Image(systemName: "plus")
                    }
                }

                if vm.isSelecting && !vm.selectedIds.isEmpty {
                    ToolbarItem(placement: .bottomBar) {
                        bulkToolbar
                    }
                }
            }
            .sheet(isPresented: $showFilters) {
                FilterSheet(vm: vm)
                    .presentationDetents([.medium, .large])
            }
            .fullScreenCover(isPresented: $showAddPart) {
                AddPartView { newPart in
                    vm.parts.insert(newPart, at: 0)
                }
            }
            .sheet(item: $selectedPart) { part in
                PartDetailView(part: part) { updatedPart in
                    vm.updatePartInList(updatedPart)
                }
            }
            .alert("Sell Part", isPresented: .init(
                get: { partToSell != nil },
                set: { if !$0 { partToSell = nil } }
            )) {
                TextField("Sale Price", text: $sellPrice)
                    .keyboardType(.decimalPad)
                Button("Sell") {
                    if let part = partToSell, let price = Double(sellPrice) {
                        Task { await vm.sellPart(part, price: price) }
                    }
                    partToSell = nil
                    sellPrice = ""
                }
                Button("Cancel", role: .cancel) {
                    partToSell = nil
                    sellPrice = ""
                }
            } message: {
                if let part = partToSell {
                    Text("Enter sale price for \(part.name)")
                }
            }
            .alert("Delete Part", isPresented: .init(
                get: { partToDelete != nil },
                set: { if !$0 { partToDelete = nil } }
            )) {
                Button("Delete", role: .destructive) {
                    if let part = partToDelete {
                        Task { await vm.deletePart(part) }
                    }
                    partToDelete = nil
                }
                Button("Cancel", role: .cancel) { partToDelete = nil }
            } message: {
                if let part = partToDelete {
                    Text("Are you sure you want to delete \"\(part.name)\"? This cannot be undone.")
                }
            }
            .task { await vm.loadParts() }
        }
    }

    // MARK: - Stats Bar

    private var statsBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                StatCard(title: "Total", value: "\(vm.totalParts)", icon: "shippingbox")
                StatCard(title: "Live", value: "\(vm.liveParts)", icon: "cart", color: .green)
                StatCard(title: "Sold", value: "\(vm.soldParts)", icon: "checkmark.seal", color: .blue)
                StatCard(title: "Value", value: vm.totalValue.formattedPrice, icon: "dollarsign.circle", color: .orange)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Parts List

    private var partsList: some View {
        List {
            ForEach(vm.filteredParts) { part in
                PartRowView(
                    part: part,
                    isSelected: vm.selectedIds.contains(part.id),
                    isSelecting: vm.isSelecting
                )
                .contentShape(Rectangle())
                .onTapGesture {
                    if vm.isSelecting {
                        vm.toggleSelection(part.id)
                    } else {
                        selectedPart = part
                    }
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        partToDelete = part
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }

                    if part.isSold {
                        Button {
                            Task { await vm.unsellPart(part) }
                        } label: {
                            Label("Unsell", systemImage: "arrow.uturn.backward")
                        }
                        .tint(.orange)
                    } else {
                        Button {
                            sellPrice = String(format: "%.2f", part.price)
                            partToSell = part
                        } label: {
                            Label("Sell", systemImage: "dollarsign")
                        }
                        .tint(.green)
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Bulk Toolbar

    private var bulkToolbar: some View {
        HStack {
            Text("\(vm.selectedIds.count) selected")
                .font(.caption)

            Spacer()

            Button { Task { await vm.bulkMarkSold() } } label: {
                Image(systemName: "checkmark.seal")
            }

            Button { Task { await vm.bulkMarkAvailable() } } label: {
                Image(systemName: "arrow.uturn.backward")
            }

            Button(role: .destructive) { Task { await vm.bulkDelete() } } label: {
                Image(systemName: "trash")
            }

            Button { vm.selectAll() } label: {
                Image(systemName: "checkmark.circle.fill")
            }
        }
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    var color: Color = .primary

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(color)
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(color)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(minWidth: 70)
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
