#!/bin/bash

# Function to validate date format
validate_date() {
    if [[ $1 =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to print usage
print_usage() {
    echo "Usage: $0 [-d DATE] [-s DATE] or $0 DATE"
    echo "  -d DATE: Show stats for exact date (format: YYYY-MM-DD)"
    echo "  -s DATE: Show stats from specified date until now (format: YYYY-MM-DD)"
    echo "  DATE: Show stats for exact date (format: YYYY-MM-DD)"
    echo "  If no option is provided, it will show stats for yesterday"
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    mode="yesterday"
elif [ $# -eq 1 ]; then
    if validate_date "$1"; then
        mode="exact"
        date_param="$1"
    else
        print_usage
        exit 1
    fi
elif [ $# -eq 2 ]; then
    if [ "$1" = "-d" ] && validate_date "$2"; then
        mode="exact"
        date_param="$2"
    elif [ "$1" = "-s" ] && validate_date "$2"; then
        mode="since"
        date_param="$2"
    else
        print_usage
        exit 1
    fi
else
    print_usage
    exit 1
fi

# Set date range based on mode
if [ "$mode" = "yesterday" ]; then
    date_param=$(date -v-1d +%Y-%m-%d)
    next_day=$(date +%Y-%m-%d)
    date_display="Yesterday ($date_param)"
elif [ "$mode" = "exact" ]; then
    next_day=$(date -j -v+1d -f "%Y-%m-%d" "$date_param" +%Y-%m-%d)
    date_display="Exact date: $date_param"
else  # mode is "since"
    next_day=$(date +%Y-%m-%d)
    date_display="From $date_param to now"
fi

# Run the git command
git log --author="$(git config user.name)" --since="$date_param" --until="$next_day" --pretty=tformat: --numstat | 
    awk -v date_display="$date_display" '
    { add += $1; subs += $2 }
    END { 
        print "Date range: " date_display
        print "Added lines: " add
        print "Removed lines: " subs
    }'