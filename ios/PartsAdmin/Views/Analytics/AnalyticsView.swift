import SwiftUI
import Charts

struct AnalyticsView: View {
    @State var vm = AnalyticsViewModel()
    let parts: [Part]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Summary cards
                    LazyVGrid(columns: [.init(), .init()], spacing: 12) {
                        AnalyticCard(title: "Total Revenue", value: vm.totalRevenue.formattedPrice, icon: "dollarsign.circle", color: .green)
                        AnalyticCard(title: "Avg Sale", value: vm.averageSalePrice.formattedPrice, icon: "chart.bar", color: .blue)
                        AnalyticCard(title: "Inventory Value", value: vm.totalInventoryValue.formattedPrice, icon: "shippingbox", color: .orange)
                        AnalyticCard(title: "Parts Sold", value: "\(vm.soldCount)", icon: "checkmark.seal", color: .purple)
                    }
                    .padding(.horizontal)

                    // Monthly revenue chart
                    if !vm.monthlyStats.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Monthly Revenue")
                                .font(.headline)
                                .padding(.horizontal)

                            Chart(vm.monthlyStats) { stat in
                                BarMark(
                                    x: .value("Month", stat.month, unit: .month),
                                    y: .value("Revenue", stat.revenue)
                                )
                                .foregroundStyle(.blue.gradient)
                            }
                            .chartXAxis {
                                AxisMarks(values: .stride(by: .month)) { _ in
                                    AxisGridLine()
                                    AxisValueLabel(format: .dateTime.month(.abbreviated))
                                }
                            }
                            .chartYAxis {
                                AxisMarks { value in
                                    AxisGridLine()
                                    AxisValueLabel {
                                        if let v = value.as(Double.self) {
                                            Text(v.formattedPrice)
                                        }
                                    }
                                }
                            }
                            .frame(height: 200)
                            .padding(.horizontal)
                        }
                        .padding(.vertical, 8)
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)
                    }

                    // Category breakdown
                    if !vm.categoryStats.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Sales by Category")
                                .font(.headline)
                                .padding(.horizontal)

                            Chart(vm.categoryStats) { stat in
                                SectorMark(
                                    angle: .value("Revenue", stat.revenue),
                                    innerRadius: .ratio(0.5)
                                )
                                .foregroundStyle(by: .value("Category", stat.label))
                            }
                            .frame(height: 200)
                            .padding(.horizontal)

                            // Legend list
                            ForEach(vm.categoryStats) { stat in
                                HStack {
                                    Text(stat.label)
                                        .font(.subheadline)
                                    Spacer()
                                    Text("\(stat.count) sold")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(stat.revenue.formattedPrice)
                                        .font(.subheadline.bold())
                                }
                                .padding(.horizontal)
                            }
                        }
                        .padding(.vertical, 12)
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Analytics")
            .onAppear { vm.loadParts(parts) }
        }
    }
}

struct AnalyticCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(value)
                .font(.title3.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
