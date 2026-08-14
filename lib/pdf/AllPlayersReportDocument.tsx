import { Document } from "@react-pdf/renderer";
import type { PlayerReport } from "@/lib/playerReport";
import { PlayerReportPage } from "./PlayerReportDocument";

export default function AllPlayersReportDocument({ reports }: { reports: PlayerReport[] }) {
  return (
    <Document>
      {reports.map((report, i) => (
        <PlayerReportPage key={i} report={report} />
      ))}
    </Document>
  );
}
