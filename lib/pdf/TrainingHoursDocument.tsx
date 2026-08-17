import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CategoryGroup } from "@/lib/planningExport";
import { minToTime } from "@/lib/planningExport";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 10, color: "#64748b", marginBottom: 18 },
  catTitle: { fontSize: 13, fontWeight: 700, color: "#0f766e", marginTop: 4, marginBottom: 2 },
  catTotal: { fontSize: 11, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 2 },
  time: { width: 170 },
  label: { flex: 1 },
  empty: { color: "#94a3b8", marginBottom: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 10, borderTopWidth: 2, borderTopColor: "#0f172a" },
  totalLabel: { fontSize: 13, fontWeight: 700 },
});

function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export default function TrainingHoursDocument({
  formationName,
  groups,
  totalMinutes,
}: {
  formationName: string;
  groups: CategoryGroup[];
  totalMinutes: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Temps de formation</Text>
        <Text style={styles.sub}>{formationName}</Text>

        {groups.map((g) => (
          <View key={g.key} wrap={false}>
            <Text style={styles.catTitle}>{g.label}</Text>
            <Text style={styles.catTotal}>{fmtHours(g.minutes)}</Text>
            {g.blocks.length === 0 ? (
              <Text style={styles.empty}>Aucun créneau.</Text>
            ) : (
              g.blocks.map((b, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.time}>
                    {b.dayLabel} · {minToTime(b.startMin)}–{minToTime(b.endMin)}
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

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalLabel}>{fmtHours(totalMinutes)}</Text>
        </View>
      </Page>
    </Document>
  );
}
