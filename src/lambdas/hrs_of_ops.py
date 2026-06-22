import zoneinfo
from datetime import date, datetime, timedelta


def _observed(d: date) -> date:
    """Return the federal observance date for a fixed holiday.
    Saturday → preceding Friday; Sunday → following Monday."""
    if d.weekday() == 5:  # Saturday
        return d - timedelta(days=1)
    if d.weekday() == 6:  # Sunday
        return d + timedelta(days=1)
    return d


def get_federal_holidays(year: int) -> set[date]:
    holidays = set()

    # Fixed-date holidays — stored as their observed date
    holidays.add(_observed(date(year, 1, 1)))   # New Year's Day
    holidays.add(_observed(date(year, 6, 19)))  # Juneteenth
    holidays.add(_observed(date(year, 7, 4)))   # Independence Day
    holidays.add(_observed(date(year, 11, 11))) # Veterans Day
    holidays.add(_observed(date(year, 12, 25))) # Christmas Day

    # New Year's Day observed on Dec 31 of the prior year when Jan 1 falls on Saturday
    if date(year, 1, 1).weekday() == 5:
        holidays.add(date(year - 1, 12, 31))

    # Floating holidays (no observance shift needed — always land on a weekday)
    def nth_weekday(n: int, weekday: int, month: int) -> date:
        first = date(year, month, 1)
        offset = (weekday - first.weekday()) % 7
        return date(year, month, 1 + offset + (n - 1) * 7)

    holidays.add(nth_weekday(3, 0, 1))  # MLK Day (3rd Monday in January)
    holidays.add(nth_weekday(3, 0, 2))  # Presidents Day (3rd Monday in February)
    last_may = date(year, 5, 31)
    memorial_day = last_may - timedelta(days=(last_may.weekday()) % 7)
    holidays.add(memorial_day)          # Memorial Day (last Monday in May)
    holidays.add(nth_weekday(1, 0, 9))  # Labor Day (1st Monday in September)
    holidays.add(nth_weekday(4, 3, 11)) # Thanksgiving (4th Thursday in November)

    return holidays


BUSINESS_START_HOUR = 9
BUSINESS_END_HOUR = 17
LAST_WEEKDAY = 4  # Friday


def is_business_hours() -> bool:
    now = datetime.now(zoneinfo.ZoneInfo("America/New_York"))
    today = now.date()

    if today in get_federal_holidays(today.year):
        return False

    if now.weekday() > LAST_WEEKDAY:
        return False

    return BUSINESS_START_HOUR <= now.hour < BUSINESS_END_HOUR


def handler(_event: dict, _context: object) -> dict:
    in_hours = is_business_hours()
    return {
        "isBusinessHours": in_hours,
        "message": "Within business hours" if in_hours else "Outside business hours",
    }
