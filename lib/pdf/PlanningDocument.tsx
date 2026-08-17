import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { GridDay } from "@/lib/planningExport";
import { GRID_DAY_START, GRID_DAY_END } from "@/lib/planningExport";

// Page A4 paysage en points : 841.89 x 595.28.
const PAGE_HEIGHT = 595.28;
const MARGIN = 24;
const HOUR_AXIS_WIDTH = 30;
const HEADER_HEIGHT = 46;

const GRID_HEIGHT = PAGE_HEIGHT - 2 * MARGIN - HEADER_HEIGHT;
const PX_PER_MIN = GRID_HEIGHT / (GRID_DAY_END - GRID_DAY_START);

const styles = StyleSheet.create({
  page: { padding: MARGIN, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  sub: { fontSize: 8, color: "#64748b", marginBottom: 8 },
  headerRow: { flexDirection: "row", height: 20 },
  hourAxisSpacer: { width: HOUR_AXIS_WIDTH },
  dayHeader: {
    flex: 1,
    fontSize: 7,
    fontWeight: 700,
    textAlign: "center",
    justifyContent: "center",
    borderLeftWidth: 0.5,
    borderLeftColor: "#cbd5e1",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingTop: 4,
  },
  bodyRow: { flexDirection: "row" },
  hourAxis: { width: HOUR_AXIS_WIDTH, position: "relative", height: GRID_HEIGHT },
  hourLabel: { position: "absolute", fontSize: 6, color: "#94a3b8" },
  daysArea: { flex: 1, flexDirection: "row", position: "relative", height: GRID_HEIGHT, borderTopWidth: 0.5, borderTopColor: "#cbd5e1" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 0.5, backgroundColor: "#e2e8f0" },
  dayColumn: { flex: 1, position: "relative", borderLeftWidth: 0.5, borderLeftColor: "#e2e8f0" },
  block: { position: "absolute", borderRadius: 2, padding: 2, overflow: "hidden" },
  blockText: { fontSize: 6, color: "#fff", fontWeight: 700 },
});

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function PlanningDocument({ formationName, days }: { formationName: string; days: GridDay[] }) {
  const hourMarks: number[] = [];
  for (let m = GRID_DAY_START; m <= GRID_DAY_END; m += 60) hourMarks.push(m);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Planning</Text>
        <Text style={styles.sub}>{formationName}</Text>

        <View style={styles.headerRow}>
          <View style={styles.hourAxisSpacer} />
          {days.map((d, i) => (
            <Text key={i} style={styles.dayHeader}>
              J{i + 1} · {d.dayLabel}
            </Text>
          ))}
        </View>

        <View style={styles.bodyRow}>
          <View style={styles.hourAxis}>
            {hourMarks.map((m) => (
              <Text key={m} style={{ ...styles.hourLabel, top: (m - GRID_DAY_START) * PX_PER_MIN - 3, right: 4 }}>
                {fmt(m)}
              </Text>
            ))}
          </View>

          <View style={styles.daysArea}>
            {hourMarks.map((m) => (
              <View key={m} style={{ ...styles.gridLine, top: (m - GRID_DAY_START) * PX_PER_MIN }} />
            ))}
            {days.map((d, i) => (
              <View key={i} style={styles.dayColumn}>
                {d.blocks.map((b) => {
                  const top = (b.startMin - GRID_DAY_START) * PX_PER_MIN;
                  const height = Math.max((b.endMin - b.startMin) * PX_PER_MIN, 8);
                  const widthPct = 100 / b.cols;
                  const leftPct = b.col * widthPct;
                  return (
                    <View
                      key={b.id}
                      style={{
                        ...styles.block,
                        top,
                        height,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: b.color,
                      }}
                    >
                      <Text style={styles.blockText}>{b.label}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
