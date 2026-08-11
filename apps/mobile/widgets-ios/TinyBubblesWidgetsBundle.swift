import WidgetKit
import SwiftUI

@main
struct TinyBubblesWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TinyBubblesTasksWidget()
        // Offers no families before iOS 16, so it stays invisible on iOS 15.
        TinyBubblesFocusLockWidget()
    }
}
