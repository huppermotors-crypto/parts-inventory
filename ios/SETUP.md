# PartsAdmin iOS App — Setup Guide

## Prerequisites
- Mac with Xcode 15+ installed
- Apple Developer account (for TestFlight / App Store)
- Supabase project URL and anon key (same as web app)

## Step 1: Create Xcode Project

1. Open **Xcode** on your Mac
2. **File → New → Project**
3. Choose **iOS → App**
4. Settings:
   - Product Name: `PartsAdmin`
   - Team: Select your Apple Developer team
   - Organization Identifier: `com.hupper` (or your own)
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: **None**
   - Uncheck "Include Tests"
5. Save to `ios/` folder (replace or merge with existing)

## Step 2: Add Swift Files

1. Delete the auto-generated `ContentView.swift` and `PartsAdminApp.swift` from Xcode
2. In Xcode, right-click the `PartsAdmin` folder → **Add Files to "PartsAdmin"**
3. Select ALL folders: `App/`, `Models/`, `Services/`, `ViewModels/`, `Views/`, `Utils/`
4. Make sure **"Create groups"** is selected (not "Create folder references")
5. Click **Add**

## Step 3: Add Supabase SDK (Swift Package Manager)

1. In Xcode: **File → Add Package Dependencies**
2. Enter URL: `https://github.com/supabase/supabase-swift`
3. Dependency Rule: **Up to Next Major Version** → `2.0.0`
4. Click **Add Package**
5. Select **Supabase** library → Add to `PartsAdmin` target

## Step 4: Configure Supabase Credentials

1. Open your project's **Info.plist** (or target's Info tab in Xcode)
2. Add two new rows:
   - Key: `SUPABASE_URL` — Value: `https://YOUR_PROJECT.supabase.co`
   - Key: `SUPABASE_ANON_KEY` — Value: `your-anon-key-here`

You can find these values in your Supabase Dashboard → Settings → API.

## Step 5: Add Camera & Photo Permissions

In **Info.plist**, add:
- `NSCameraUsageDescription` → "Take photos of parts for inventory"
- `NSPhotoLibraryUsageDescription` → "Select photos of parts from your library"

## Step 6: Set Deployment Target

1. Select the **PartsAdmin** target
2. Under **General → Minimum Deployments**, set to **iOS 17.0**

## Step 7: Run!

1. Select an iPhone simulator or connect your iPhone
2. Press **Cmd+R** to build and run
3. Sign in with your admin email: `nvn9586@gmail.com`

## App Store Submission (Later)

1. In Xcode: **Product → Archive**
2. Upload to App Store Connect
3. Fill in app metadata, screenshots, description
4. Submit for review

## Project Structure

```
PartsAdmin/
├── App/
│   ├── PartsAdminApp.swift      — App entry point
│   └── ContentView.swift        — Auth gate + TabView navigation
├── Models/
│   ├── Part.swift               — Part data model (matches Supabase schema)
│   ├── PriceRule.swift           — Price rules
│   └── Vehicle.swift            — VIN decode types
├── Services/
│   ├── SupabaseService.swift    — Supabase client singleton
│   ├── AuthService.swift        — Login/logout/session management
│   ├── PartsService.swift       — Full CRUD + bulk ops + sell/unsell
│   ├── StorageService.swift     — Photo upload/delete to Supabase Storage
│   ├── VINService.swift         — NHTSA VIN decode API
│   └── ImageCompressor.swift    — Compress photos to ≤300KB
├── ViewModels/
│   ├── PartsListViewModel.swift — Dashboard: filters, sort, search, bulk ops
│   ├── PartFormViewModel.swift  — Add/Edit form logic + VIN decode
│   ├── ListingsViewModel.swift  — FB/eBay listings management
│   └── AnalyticsViewModel.swift — Sales analytics calculations
├── Views/
│   ├── Auth/LoginView.swift
│   ├── Dashboard/
│   │   ├── DashboardView.swift  — Main inventory list
│   │   ├── PartRowView.swift    — List row with photo, info, price
│   │   └── FilterSheet.swift    — Filters + sort sheet
│   ├── AddPart/
│   │   ├── AddPartView.swift    — Full add form with photos
│   │   └── VINScannerView.swift — Camera VIN OCR scanner
│   ├── PartDetail/
│   │   ├── PartDetailView.swift — View + edit part details
│   │   └── PhotoGalleryView.swift — Photo viewer with thumbnails
│   ├── Listings/ListingsView.swift
│   ├── Analytics/AnalyticsView.swift — Charts + stats
│   └── Shared/ConditionBadge.swift
└── Utils/
    ├── Constants.swift          — Categories, conditions (matches web)
    └── Extensions.swift         — Price/date formatting
```
