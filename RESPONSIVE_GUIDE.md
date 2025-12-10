# Responsive Design Implementation Guide

## Overview

The Sweet Box system now includes comprehensive responsive design that adapts the interface for mobile, tablet, and desktop devices while maintaining full functionality.

## Mobile Navigation

### Features

1. **Persistent Elements**: Logo, live clock, and user session remain visible at all times
2. **Collapsible Navigation**: Only the page navigation menu is compressed on tablet/mobile
3. **Mobile Hamburger**: Touch-friendly button to open sidebar on mobile devices
4. **Smooth Animations**: CSS transitions for a polished user experience

### How It Works

#### Desktop (>1100px)

- Full sidebar visible with all elements
- Traditional desktop layout

#### Tablet (768px - 1100px)

- Sidebar hidden by default, slides in from left
- Navigation menu collapsed by default
- "Navigation" toggle button expands/collapses menu
- Logo, clock, and user session always visible
- Mobile hamburger button shows sidebar

#### Mobile (<768px)

- Same as tablet but optimized for smaller screens
- Touch-optimized buttons and spacing

### Usage

The mobile navigation is automatically initialized. No manual setup required.

```javascript
// Auto-initialized in common.js
initMobileNavigation();
```

## Mobile Table System

### Problem Solved

Long tables with many columns are difficult to read on mobile devices. The solution shows only the primary information (usually a name) with a "Details" button that opens a modal with all information.

### How It Works

#### Desktop View

- Standard HTML table with all columns visible
- Full row layout

#### Mobile View

- Simplified rows showing only the primary field (e.g., employee name)
- "Details" button on each row
- Clicking "Details" opens a modal with all record information neatly formatted

### Implementation Example

```javascript
// Check if mobile view
if (window.isMobileView && window.isMobileView()) {
  // Define fields to display
  const fields = [
    { key: "name", label: "Employee Name", format: (val) => val },
    { key: "status", label: "Status", format: (val) => val.toUpperCase() },
    { key: "timestamp", label: "Time", format: (val) => formatTime(val) },
  ];

  // Render mobile table
  window.renderMobileTable(data, fields, container);
} else {
  // Regular desktop table rendering
  renderDesktopTable(data);
}
```

### Field Configuration

```javascript
{
  key: 'fieldName',           // Property name in data object
  label: 'Display Label',     // Label shown in detail modal
  format: (value, item) => {  // Optional formatter function
    return formattedValue;    // Can access full item for context
  }
}
```

### Custom Detail Modal

```javascript
// Custom handler for detail button
window.renderMobileTable(data, fields, container, (item) => {
  // Your custom modal logic
  window.showMobileDetailModal(item, fields);
});
```

## Dashboard Charts

### Desktop

- Charts displayed in a flexible grid layout
- Multiple charts per row when space allows

### Tablet/Mobile (<900px)

- All charts stack vertically
- Full width for better readability
- Single column layout

## Breakpoints

| Breakpoint  | Width          | Description                          |
| ----------- | -------------- | ------------------------------------ |
| Desktop     | >1100px        | Full layout, sidebar always visible  |
| Tablet      | 768px - 1100px | Collapsible sidebar, compressed nav  |
| Mobile      | <768px         | Off-screen sidebar, mobile-optimized |
| Chart Stack | <900px         | Vertical chart stacking              |

## CSS Files

- **responsive.css**: Main responsive styles and media queries
- **design.css**: Base styles with CSS custom properties
- **dynamic-components.css**: Modal, toast, and dynamic UI styles

## JavaScript Functions

### Navigation

- `initMobileNavigation()` - Initialize mobile nav (auto-called)
- `closeMobileSidebar()` - Close the mobile sidebar
- `isMobileView()` - Check if current view is mobile (<768px)

### Tables

- `renderMobileTable(data, fields, container, onDetailClick?)` - Render mobile table
- `showMobileDetailModal(item, fields)` - Show detail modal

## Pages with Mobile Tables

Currently implemented:

- ✅ Attendance page (both status board and logs)

To be implemented:

- Employees page
- Inventory page
- Orders page
- Analytics page (if needed)
- Archive page

## Adding Mobile Tables to New Pages

1. Import common.js (already done for all pages)
2. Wrap table rendering in mobile check:

```javascript
function renderMyTable() {
  const tbody = document.querySelector("#my-table tbody");

  if (window.isMobileView && window.isMobileView()) {
    // Mobile rendering
    const container = tbody.closest("table").parentElement;
    container.innerHTML = '<div id="mobile-my-data"></div>';
    const mobileContainer = document.getElementById("mobile-my-data");

    const fields = [
      { key: "name", label: "Name", format: (v) => v },
      { key: "other", label: "Other Field", format: (v) => v },
    ];

    window.renderMobileTable(myData, fields, mobileContainer);
  } else {
    // Desktop rendering (existing code)
    tbody.innerHTML = "";
    myData.forEach((item) => {
      // Regular table row creation
    });
  }
}
```

3. Add resize listener:

```javascript
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.body.dataset.page === "my-page") {
      renderMyTable();
    }
  }, 250);
});
```

## Testing Responsive Design

### Browser DevTools

1. Open Chrome/Edge DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Select device presets or custom dimensions
4. Test at: 320px, 768px, 1100px, 1920px

### Key Things to Test

- ✅ Sidebar opens/closes smoothly
- ✅ Navigation expands/collapses
- ✅ Tables switch to mobile view correctly
- ✅ Detail modals display all information
- ✅ Charts stack properly
- ✅ Touch targets are large enough (min 44px)
- ✅ No horizontal scrolling
- ✅ All functionality works on mobile

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 12+)
- IE11: Not supported (uses modern CSS features)

## Performance Notes

- Resize handler uses debouncing (250ms delay) to prevent excessive re-renders
- Mobile tables are lighter weight than full HTML tables
- Animations use CSS transforms for GPU acceleration
- Backdrop uses fixed positioning to avoid layout recalculation

## Accessibility

- All buttons have proper touch targets (minimum 44x44px)
- Keyboard navigation supported
- ARIA labels can be added as needed
- Color contrast meets WCAG AA standards
- Focus states visible on all interactive elements

## Future Enhancements

- [ ] Swipe gestures for sidebar (optional)
- [ ] Pull-to-refresh on mobile
- [ ] PWA support for offline usage
- [ ] Native app-like transitions
- [ ] Landscape orientation optimizations
