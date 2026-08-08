#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

/*
 * Keeps a benign Fabric child-index desync from aborting the app.
 *
 * -[RCTViewComponentView unmountChildComponentView:index:] (RN 0.81.5,
 * RCTViewComponentView.mm:163) guards its RCTAssert *condition* with a bounds
 * check, but the failure *message* it formats afterwards calls
 * -objectAtIndex: unguarded. RCT_NSASSERT is 0 in release, so a failed assert
 * is meant to be logged and survived -- the real work,
 * -[UIView removeFromSuperview], never needed the index at all. Instead the
 * message raises NSRangeException and SIGABRTs, and Meta ships the prebuilt
 * React.framework without NS_BLOCK_ASSERTIONS, so this is live in App Store
 * builds. Five user crash reports on 1.1.0/1.1.5 were all this one line.
 *
 * So: run the original, and if its diagnostic throws, log it and perform the
 * unmount it was about to perform anyway. Subclasses that inherit the method
 * are covered; ones that override it (scroll view, modal host) carry no assert.
 *
 * Delete this file once upstream guards the assert's format arguments; the
 * guard is inert while the original does not throw.
 */

@interface MWFabricUnmountGuard : NSObject
@end

@implementation MWFabricUnmountGuard

static void (*MWOriginalUnmountChildComponentView)(id, SEL, UIView *, NSInteger);

static void MWGuardedUnmountChildComponentView(id self, SEL _cmd, UIView *childComponentView, NSInteger index)
{
  @try {
    MWOriginalUnmountChildComponentView(self, _cmd, childComponentView, index);
  } @catch (NSException *exception) {
    // The child is still mounted -- the original threw before unmounting it.
    // On the _removeClippedSubviews path this leaves a stale _reactSubviews
    // entry, which is survivable; the app aborting is not.
    NSLog(@"[MWFabricUnmountGuard] recovered from %@ unmounting %@ at index %ld of %@: %@",
          exception.name,
          childComponentView,
          (long)index,
          self,
          exception.reason);
    [childComponentView removeFromSuperview];
  }
}

+ (void)load
{
  Class componentViewClass = NSClassFromString(@"RCTViewComponentView");
  SEL selector = NSSelectorFromString(@"unmountChildComponentView:index:");
  Method method = componentViewClass ? class_getInstanceMethod(componentViewClass, selector) : NULL;
  if (method == NULL) {
    return;
  }

  MWOriginalUnmountChildComponentView =
      (void (*)(id, SEL, UIView *, NSInteger))method_setImplementation(method, (IMP)MWGuardedUnmountChildComponentView);
}

@end
