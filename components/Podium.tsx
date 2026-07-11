import type { ScoreRow } from "@/app/data/types";

export default function Podium({ rows }: { rows: ScoreRow[] }) {
  return (
    <div className="podium">
      <div className="podium-slot silver">
        <div className="rank-num">02</div>
        <div className="name">{rows[1].name}</div>
        <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
        <div className="date">{rows[1].date}</div>
      </div>
      <div className="podium-slot gold">
        <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>
          CAMPEÓN
        </div>
        <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
          01
        </div>
        <div className="name">{rows[0].name}</div>
        <div className="score" style={{ fontSize: 20 }}>
          {rows[0].score.toLocaleString("es-ES")}
        </div>
        <div className="date">{rows[0].date}</div>
      </div>
      <div className="podium-slot bronze">
        <div className="rank-num">03</div>
        <div className="name">{rows[2].name}</div>
        <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
        <div className="date">{rows[2].date}</div>
      </div>
    </div>
  );
}
