# Calendar Summary

Chrome extension that analyzes your Google Calendar and displays a summary of activities with total time calculations.

## Features

- Automatically detects Google Calendar page
- Parses visible calendar events
- Groups activities by name
- Calculates total time per activity
- Shows summary overlay with activity breakdown
- Adapts to different calendar views (day, week, month)

## Development

### Setup

```bash
yarn install
yarn build
```

### Build

```bash
yarn build
```

### Watch Mode

```bash
yarn watch
```

## Installation in Chrome

**You don't need to publish the extension!** You can load it directly as an unpacked extension:

1. Build the extension:
   ```bash
   yarn build
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **"Developer mode"** (toggle in top right corner)

4. Click **"Load unpacked"** button

5. Select the `dist` folder from this project

6. The extension will now be active on Google Calendar pages!

**Note:** Icons are optional. If you see a warning about missing icons, you can ignore it or add icon files to the `icons/` folder (see `icons/README.md`).

## Architecture

- **TypeScript** with strict typing
- **SOLID principles**: Single responsibility, dependency injection
- **Modular design**: Separate services for detection, parsing, calculation, UI
- **Extensible**: Easy to add new features or modify behavior

## Project Structure

```
src/
  types.ts          - Type definitions
  page-detector.ts  - Detects Google Calendar page state
  event-parser.ts   - Parses events from DOM
  time-calculator.ts - Calculates activity summaries
  summary-ui.ts     - UI overlay component
  content.ts        - Main entry point
```

## License

MIT

