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
                Text(context.state.title).font(.headline)
                Text(context.state.period).font(.subheadline)
                HStack {
                    Text(context.state.percentage)
                    Spacer()
                    Text(context.state.remaining)
                }
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Region
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.period)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.remaining)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("\(context.state.percentage) Complete")
                }
            } compactLeading: {
                Text(context.state.period)
            } compactTrailing: {
                Text(context.state.remaining)
            } minimal: {
                Text("📚")
            }
        }
    }
}
