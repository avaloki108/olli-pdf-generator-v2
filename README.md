# OLLI PDF Generator v2

An Electron + React desktop application for managing OLLI Walks and Hikes locations and generating PDF schedules.

## Features

- **Location Database**: Manage a database of walk/hike locations with address, town, and notes
- **Excel Import**: Import locations from Excel files (.xlsx, .xls, .csv)
- **PDF Generation**: Generate formatted PDF schedules for walks and hikes
- **Monthly Planning**: Plan walks (Mondays) and hikes (Thursdays) by month

## To Use

**With npm:**

```bash
# Clone this repository
git clone https://github.com/avaloki108/olli-pdf-generator-v2.git
# Go into the repository
cd olli-pdf-generator-v2
# Install dependencies
npm install
# Run the app
npm start
```

**With pnpm:**

```bash
# Clone this repository
git clone https://github.com/avaloki108/olli-pdf-generator-v2.git
# Go into the repository
cd olli-pdf-generator-v2
# Install dependencies
pnpm install
# Run the app
pnpm start
```

## Build for Distribution

**With npm:**

```bash
# Build the React app
npm run build
# Create Windows installer
npm run dist:win
```

**With pnpm:**

```bash
# Build the React app
pnpm run build
# Create Windows installer
pnpm run dist:win
```

## Excel Import Format

The Excel import expects columns:
- **Location** - Name of the location (required)
- **Street Address** - Physical address
- **Town** - City/town name
- **Meeting Location Notes** - Where to meet
- **Comments** - Additional notes

## License

[CC0 1.0 (Public Domain)](LICENSE.md)
