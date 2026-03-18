import WidgetKit
import SwiftUI
import ActivityKit

@main
struct WidgetExtension: WidgetBundle {
    var body: some Widget {
        LiveActivityWidget()
    }
}

struct LiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            // Lock screen / Banner UI
            VStack {
                Text(context.state.values["title"] ?? "").font(.headline)
                Text(context.state.values["period"] ?? "").font(.subheadline)
                HStack {
                    Text(context.state.values["percentage"] ?? "")
                    Spacer()
                    Text(context.state.values["remaining"] ?? "")
                }
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Region
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.values["period"] ?? "")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.values["remaining"] ?? "")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.values["title"] ?? "")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("\(context.state.values["percentage"] ?? "") Complete")
                }
            } compactLeading: {
                Text(context.state.values["period"] ?? "")
            } compactTrailing: {
                Text(context.state.values["remaining"] ?? "")
            } minimal: {
                Text("📚")
            }
        }
    }
}
