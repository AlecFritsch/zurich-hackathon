# Sorting Procedure v1

## Overview
Factory parts must be sorted by color and size into designated bins.

## Decision Rules
1. Defective parts → REJECT_BIN
2. Red parts > 50mm → BIN_A
3. Blue parts 30-50mm → BIN_B
4. Green parts < 30mm → BIN_C
5. Low confidence → REVIEW_BIN

## Safety
- Max speed: 80%
- Max grip force: 15N

## Inspection
- Visual defect check
- Color and size classification
