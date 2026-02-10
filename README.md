# Google Calendar Multi-Select

A Chrome extension that adds multi-select functionality to Google Calendar, enabling bulk delete and move/reschedule operations.

## Features

- **Multi-select events** - Ctrl+click (Cmd+click on Mac) to select multiple events
- **Range selection** - Shift+click to select a range of events
- **Bulk delete** - Delete multiple events at once
- **Bulk move** - Move multiple events to a different calendar
- **Bulk reschedule** - Change the date/time of multiple events at once
- **Visual feedback** - Clear visual indicators for selected events
- **Selection badge** - Floating counter showing number of selected events

## Installation

### 1. Set Up Google Cloud Project

Before using the extension, you need to create API credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Google Calendar API**:
   - Go to APIs & Services → Library
   - Search for "Google Calendar API"
   - Click Enable

4. Configure OAuth consent screen:
   - Go to APIs & Services → OAuth consent screen
   - Select "External" user type
   - Fill in app name and support email
   - Add scope: `https://www.googleapis.com/auth/calendar`
   - Add yourself as a test user

5. Create OAuth credentials:
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Chrome extension**
   - Enter your extension ID (you'll get this after loading the extension - see step 2)

### 2. Load the Extension

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `gcal-multiselect` folder
5. Note the **Extension ID** shown on the extension card

### 3. Add Your Client ID

1. Copy the Client ID from your Google Cloud OAuth credentials
2. Open `manifest.json` in the extension folder
3. Replace `YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with your Client ID
4. Go back to `chrome://extensions` and click the refresh button on the extension

## Usage

### Selecting Events

- **Single select**: Ctrl+click (Cmd+click on Mac) on an event
- **Range select**: Select an event, then Shift+click another event to select all events between them
- **Select all**: Ctrl+Shift+A (Cmd+Shift+A on Mac) to select all visible events
- **Deselect**: Ctrl+click on a selected event, or press Escape to clear all selections

### Bulk Actions

1. Select the events you want to manage
2. Click the extension icon in your toolbar
3. Choose an action:
   - **Delete Selected**: Permanently removes all selected events
   - **Move / Reschedule**: Opens a dialog to move events to another calendar or change their date/time

## File Structure

```
gcal-multiselect/
├── manifest.json           # Extension configuration
├── src/
│   ├── content/
│   │   ├── content.js      # DOM manipulation, selection UI
│   │   └── styles.css      # Selection styling
│   ├── background/
│   │   └── background.js   # Service worker, OAuth, API calls
│   ├── popup/
│   │   ├── popup.html      # Extension popup
│   │   ├── popup.js        # Popup logic
│   │   └── popup.css       # Popup styling
│   └── utils/
│       └── calendar-api.js # Google Calendar API wrapper
├── icons/
│   └── icon-*.png          # Extension icons
└── README.md
```

## Permissions

The extension requires the following permissions:

- `identity`: For Google OAuth authentication
- `storage`: To store selected events temporarily
- `https://calendar.google.com/*`: To inject the selection UI
- `https://www.googleapis.com/*`: To make Calendar API calls

## Troubleshooting

### "Sign in with Google" doesn't work
- Make sure you've added your Client ID to `manifest.json`
- Verify the extension ID in your OAuth credentials matches
- Check that you're added as a test user in the OAuth consent screen

### Events aren't being selected
- Make sure you're holding Ctrl (or Cmd on Mac) while clicking
- The extension only works on `calendar.google.com`
- Try refreshing the page

### API errors when deleting/moving
- Some events may be read-only (from shared calendars)
- Recurring events may need special handling
- Check that your OAuth scope includes calendar access

## Development

To modify the extension:

1. Make changes to the source files
2. Go to `chrome://extensions`
3. Click the refresh button on the extension card
4. Reload Google Calendar

## License

MIT License - feel free to modify and share!
