import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 18 },
  name: { fontSize: 13, fontWeight: 700, color: "#0f766e", marginBottom: 6 },
  text: { marginBottom: 3 },
  empty: { color: "#94a3b8" },
  entry: { marginBottom: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 12 },
});

export type AppraisalItem = { firstName: string; finalAppraisal: string };

export default function FinalAppraisalsDocument({ items }: { items: AppraisalItem[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Appréciations finales</Text>
        {items.map((item, i) => (
          <View key={i} style={styles.entry} wrap={false}>
            <Text style={styles.name}>{item.firstName}</Text>
            <Text style={item.finalAppraisal ? styles.text : [styles.text, styles.empty]}>
              {item.finalAppraisal || "Rien pour l'instant."}
            </Text>
            <View style={styles.divider} />
          </View>
        ))}
      </Page>
    </Document>
  );
}
