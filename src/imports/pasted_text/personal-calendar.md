Build a Personal Climbing Gym Calendar screen as a mobile app screen (390px wide).

---

## SCREEN STRUCTURE

The screen has 4 main sections stacked vertically:
1. Top navigation bar
2. Filter chip bar (with settings gear icon)
3. Monthly calendar grid
4. Selected date detail section (card slider)

Fixed bottom tab bar at the bottom.

---

## 1. TOP NAVIGATION BAR

- Height: 52px
- Left: back arrow icon button (32×32, circle, border, bg: surface)
- Center: title text "개인 캘린더" (17px, medium weight)
- Right: settings gear icon button (32×32, circle, border, bg: surface)
- Border bottom: 0.5px, color token border/tertiary

---

## 2. FILTER CHIP BAR

Layout: horizontal row, padding 0 16px 12px, gap 8px, align center.

Left side — horizontally scrollable chip list (flex: 1, overflow-x: scroll, gap 6px):
Each chip contains:
  - Checkbox square (14×14, border-radius 3px, border 1.5px in gym color)
    - When checked: filled with gym color + white checkmark SVG inside
    - When unchecked: empty, border only
  - Color dot (6×6, circle, filled with gym color)
  - Label text (12px, medium, gym color when active / secondary color when inactive)
  - Chip border: 1.5px, gym color when active / border/tertiary when inactive
  - Chip border-radius: 20px
  - Chip padding: 5px 10px

Right side — gear icon button (30×30, border-radius 8px, border 0.5px, bg: surface):
  - Icon: gear/settings SVG (16×16, color: text/secondary)
  - On tap: opens a settings dropdown modal (see Gear Modal below)

Gym list (4 gyms):
  - 더클라임 강남 → color #185FA5
  - 더클라임 양재 → color #3B6D11
  - 클라임웍스 홍대 → color #D85A30
  - 더클라임 신촌 → color #854F0B

---

## 3. GEAR MODAL (dropdown, appears top-right on gear tap)

- Position: absolute, top 60px, right 16px
- Width: 220px
- Background: surface/primary, border-radius 12px, border 0.5px border/secondary
- Open animation: scale from 0.92→1 + fade in (0.18s ease)
- Backdrop: semi-transparent overlay behind modal, tap to close

Header row:
  - Text: "암장 표시 설정" (13px, medium)
  - Border bottom: 0.5px

For each gym, a toggle row:
  - Left: colored dot (10×10) + gym name (13px)
  - Right: iOS-style toggle switch (36×20, border-radius 10px)
    - ON state: background #185FA5, knob slides to right
    - OFF state: background surface/secondary, knob on left
  - Tapping a row toggles that gym on/off
  - Changes sync instantly with the filter chips and calendar

---

## 4. MONTHLY CALENDAR

Container: padding 0 16px 12px

Calendar header row:
  - Left: calendar icon (14×14 SVG) + month label text e.g. "2025년 5월" (15px, medium)
  - Right: prev/next arrow buttons (26×26, border-radius 6px, border 0.5px, bg surface)
  - Tapping arrows changes the displayed month

Day-of-week row:
  - 7 columns: 월 화 수 목 금 토 일
  - Font: 11px, color text/tertiary
  - 토 column: color #185FA5
  - 일 column: color #E24B4A

Calendar day grid:
  - 7 columns, gap 1px
  - Each cell (min-height 52px, border-radius 6px, padding 4px 3px 3px):
    - Day number centered at top (font 12px)
      - Today: number inside filled circle (20×20, bg #185FA5, white text)
      - Selected: same filled circle style
      - Saturday numbers: color #185FA5
      - Sunday numbers: color #E24B4A
      - Other-month days: color text/tertiary
    - Wall tags below the number (if that day has setting data):
      - Show up to 2 tags stacked vertically
      - Each tag: font 9px medium, padding 1px 4px, border-radius 3px
      - Tag background = gym's light background color
      - Tag text = gym's dark text color
      - Tag label = wall name (e.g. "메인월", "오버행", "슬랩", "미들월")
      - If more than 2 entries: show "+N" tag in neutral color
    - Tap: selects the date → updates the detail section below
    - Long press (500ms hold): opens center popup modal (see Day Popup below)
  - Selected day cell: background #E6F1FB

---

## 5. DAY POPUP MODAL (center, on long press)

Trigger: long press (500ms) on any calendar day cell.

Backdrop: covers full screen, rgba black 45% opacity, fade in 0.22s. Tap backdrop to close.

Modal box:
  - Position: centered (flexbox center both axes), margin 20px on sides
  - Background: surface/primary
  - Border-radius: 18px
  - Border: 0.5px border/tertiary
  - Max-height: 460px, flex column layout
  - Open animation: scale 0.88→1 with spring easing + fade in 0.18s

Modal header:
  - Left: date text e.g. "2025년 5월 12일" (15px, medium)
  - Right: close ✕ button (24×24 circle, bg surface/secondary, border 0.5px)

Modal body (scrollable):
  - Padding: 10px 12px
  - For each gym entry on that date, show a card:
    - Border: 0.5px border/tertiary, border-radius 12px, margin-bottom 8px
    - Card header: gym avatar (28×28, border-radius 6px, bg gym light color) + gym name (13px medium) + sector name (11px secondary) + badge pill if applicable
    - Wall row: wall name chip (gym colors) + time text with clock icon
    - Protocol row: location pin icon + protocol text (11px, text/tertiary)
  - If no entries on that date: show empty state text "이 날짜에 등록된 세팅 정보가 없습니다."

Modal footer:
  - Full-width button "기록 페이지로 이동" with + icon on left
  - Background: #185FA5, white text, border-radius 12px, height 42px
  - On tap: navigate to the existing record page

---

## 6. DETAIL SECTION (below calendar)

Divider: 0.5px horizontal line, margin 0 16px

Section header:
  - Left: blue accent bar (3×16px, color #185FA5, border-radius 2px) + date label text (14px medium)
  - Right: branch count pill (e.g. "3개 암장"), font 11px, bg surface/secondary, border-radius 10px
  - Default label text: "날짜를 선택하세요"
  - If no data for selected date: show empty message text

Card slider (when a date with data is selected):
  - Horizontal slider, one card visible at a time (full width)
  - Slide transition: translateX with 0.28s ease
  - Each card (border 0.5px, border-radius 12px, overflow hidden):
    - Card top: gym avatar (36×36, border-radius 8px) + gym name (14px medium) + sector (11px secondary) + badge (if any)
    - Photo/diagram area (height 148px, margin 0 14px, border-radius 10px, bg surface/secondary):
      - 5×3 grid of circular route holds
      - Each hold: circle, border 1.5px in route color, light fill (same color at 17% opacity)
      - Time badge overlay at bottom-left (dark semi-transparent bg, white text 11px, clock icon)
    - Card footer: location pin icon + protocol text (12px, text/secondary)
  - Dot indicators below slider: 6px circles, active dot stretches to 16px width, color #185FA5
  - Touch/swipe support to change slide

---

## 7. BOTTOM TAB BAR

- Height: ~58px
- Border top: 0.5px border/tertiary
- 4 tabs evenly spaced: 홈 / 일정 / 통계 / 프로필
- Each tab: icon (18px) + label (10px)
- Active tab (홈): label color #185FA5
- Inactive tabs: label color text/tertiary

---

## INTERACTION SUMMARY

| Action | Result |
|---|---|
| Tap filter chip | Toggle gym on/off, sync with calendar and detail |
| Tap gear icon | Open gear dropdown modal |
| Tap gear modal backdrop | Close gear modal |
| Tap gear toggle row | Toggle gym visibility |
| Tap prev/next arrow | Change calendar month |
| Tap calendar day | Select date, update detail section |
| Long press calendar day (500ms) | Open centered day popup modal |
| Tap popup backdrop or ✕ | Close popup |
| Tap "기록 페이지로 이동" | Navigate to record page |
| Swipe or tap dots in detail section | Slide between gym cards |

---

## DESIGN TOKENS

- Primary blue: #185FA5
- Surface primary: white (light) / dark card (dark mode)
- Surface secondary: light gray surface
- Border tertiary: very subtle 0.5px border
- Text primary: near-black
- Text secondary: muted gray
- Text tertiary: hint gray
- Border radius card: 12px
- Border radius chip: 20px
- Border radius modal: 18px

Gym colors:
| Gym | Main color | Light bg | Dark text |
|---|---|---|---|
| 더클라임 강남 | #185FA5 | #E6F1FB | #0C447C |
| 더클라임 양재 | #3B6D11 | #EAF3DE | #27500A |
| 클라임웍스 홍대 | #D85A30 | #FAECE7 | #712B13 |
| 더클라임 신촌 | #854F0B | #FAEEDA | #633806 |