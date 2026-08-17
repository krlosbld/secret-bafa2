import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { minToTime } from "@/lib/planningExport";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 10, color: "#64748b", marginBottom: 18 },
  dayTitle: { fontSize: 13, fontWeight: 700, color: "#0f766e", marginTop: 10, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 2 },
  time: { width: 100 },
  label: { flex: 1 },
  empty: { color: "#94a3b8", marginBottom: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 8 },
});

export type PlanningDay = {
  dayLabel: string;
  blocks: { startMin: number; endMin: number; label: string; posteLabel: string }[];
};

export default function PlanningDocument({ formationName, days }: { formationName: string; days: PlanningDay[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Planning</Text>
        <Text style={styles.sub}>{formationName}</Text>

        {days.map((d, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.dayTitle}>
              Jour {i + 1} — {d.dayLabel}
            </Text>
            {d.blocks.length === 0 ? (
              <Text style={styles.empty}>Rien de prévu.</Text>
            ) : (
              d.blocks.map((b, j) => (
                <View key={j} style={styles.row}>
                  <Text style={styles.time}>
                    {minToTime(b.startMin)}–{minToTime(b.endMin)}
                  </Text>
                  <Text style={styles.label}>
                    {b.label} ({b.posteLabel})
                  </Text>
                </View>
              ))
            )}
            <View style={styles.divider} />
          </View>
        ))}
      </Page>
    </Document>
  );
}
