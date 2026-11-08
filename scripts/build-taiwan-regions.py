"""Build region representative points from NLSC township SHP data.

Requires pyshp and shapely. Usage: python scripts/build-taiwan-regions.py <source-dir>
Source: https://maps.nlsc.gov.tw/pro/download.jsp
Licence: https://data.gov.tw/license (Open Government Data License 1.0).
"""
import json
import sys
from pathlib import Path

import shapefile
from shapely.geometry import shape

source = Path(sys.argv[1])
files = list(source.glob("TOWN_MOI_*.shp"))
if len(files) != 1:
    raise SystemExit("Expected one NLSC TOWN_MOI shapefile")

rows = []
reader = shapefile.Reader(str(files[0]), encoding="utf-8")
for record in reader.iterShapeRecords():
    fields = record.record.as_dict()
    geometry = shape(record.shape.__geo_interface__)
    # Use the largest land polygon so offshore islets do not pull a district's
    # representative point into the sea. representative_point stays on land.
    land = max(geometry.geoms, key=lambda item: item.area) if geometry.geom_type == "MultiPolygon" else geometry
    point = land.representative_point()
    rows.append({"code": fields["TOWNCODE"], "county": fields["COUNTYNAME"],
                 "district": fields["TOWNNAME"], "lat": round(point.y, 5), "lng": round(point.x, 5)})

if len(rows) != 368 or len({row["code"] for row in rows}) != len(rows):
    raise SystemExit("Unexpected township count or duplicate codes")

target = Path(__file__).resolve().parents[1] / "src/lib/taiwan-regions.json"
target.write_text(json.dumps(sorted(rows, key=lambda row: row["code"]), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(rows)} districts in {len({row['county'] for row in rows})} counties/cities to {target.name}")
