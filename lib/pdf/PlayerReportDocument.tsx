import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PlayerReport } from "@/lib/playerReport";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  sub: { fontSize: 10, color: "#64748b", marginBottom: 18 },
  dayTitle: { fontSize: 13, fontWeight: 700, marginTop: 4, marginBottom: 8, color: "#0f766e" },
  sectionLabel: { fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 200, fontWeight: 700 },
  value: { flex: 1 },
  block: { marginBottom: 3 },
  empty: { color: "#94a3b8" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 12 },
});

export default function PlayerReportDocument({ report }: { report: PlayerReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.firstName}</Text>
        <Text style={styles.sub}>Code #{report.code} — Dossier d&apos;évaluation</Text>

        {report.days.map((day, idx) => (
          <View key={idx} wrap={false}>
            <Text style={styles.dayTitle}>
              Jour {idx + 1} — {day.dayLabel}
            </Text>

            <Text style={styles.sectionLabel}>Créneaux évalués</Text>
            {day.evaluations.length === 0 ? (
              <Text style={styles.empty}>Aucun créneau évaluable ce jour.</Text>
            ) : (
              day.evaluations.map((e, i) => (
                <View key={i} style={styles.block}>
                  <Text style={{ fontWeight: 700 }}>
                    {e.time} · {e.label}
                  </Text>
                  <Text style={e.note ? undefined : styles.empty}>{e.note || "Non noté"}</Text>
                </View>
              ))
            )}

            <Text style={styles.sectionLabel}>Critères</Text>
            {day.criteria.length === 0 ? (
              <Text style={styles.empty}>Aucun critère configuré.</Text>
            ) : (
              day.criteria.map((c, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.label}>{c.label}</Text>
                  <Text style={c.stateLabel ? styles.value : [styles.value, styles.empty]}>
                    {c.stateLabel || "Non observé"}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.sectionLabel}>Remarque</Text>
            <Text style={day.remark ? undefined : styles.empty}>{day.remark || "Rien pour ce jour."}</Text>

            <View style={styles.divider} />
          </View>
        ))}

        <View wrap={false}>
          <Text style={styles.dayTitle}>Informations générales</Text>

          <Text style={styles.sectionLabel}>Info personnelle</Text>
          <Text style={report.personalNote ? styles.block : [styles.block, styles.empty]}>
            {report.personalNote || "Rien pour l'instant."}
          </Text>

          <Text style={styles.sectionLabel}>EMS (entretien de mi-stage)</Text>
          <Text style={report.ems ? styles.block : [styles.block, styles.empty]}>
            {report.ems || "Rien pour l'instant."}
          </Text>

          <Text style={styles.sectionLabel}>Entretien complémentaire</Text>
          <Text style={report.complementaryNote ? styles.block : [styles.block, styles.empty]}>
            {report.complementaryNote || "Rien pour l'instant."}
          </Text>

          <Text style={styles.sectionLabel}>Appréciation finale</Text>
          <Text style={report.finalAppraisal ? styles.block : [styles.block, styles.empty]}>
            {report.finalAppraisal || "Rien pour l'instant."}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
