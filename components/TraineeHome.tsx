import Link from "next/link";
import type { HomeBlock, TraineeHomeData } from "@/lib/traineeHome";
import TimelineScroller from "@/components/TimelineScroller";

// Accueil du stagiaire : programme du jour heure par heure (à gauche), dernière évaluation (à droite).

const HOUR_PX = 64;

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m ? String(m).padStart(2, "0") : ""}`;
}

function Block({ b, startHour }: { b: HomeBlock; startHour: number }) {
  const top = ((b.startMin - startHour * 60) / 60) * HOUR_PX;
  const height = Math.max(((b.endMin - b.startMin) / 60) * HOUR_PX - 4, 22);
  const compact = height < 52; // tout sur une ligne
  const short = !compact && height < (b.cols > 1 ? 100 : 76); // titre sur une ligne, sans le type
  return (
    <div
      className={`th-block${compact ? " th-block--compact" : ""}${short ? " th-block--short" : ""}${b.mine ? " th-block--mine" : ""}`}
      style={{
        top,
        height,
        left: `calc(${(b.col / b.cols) * 100}% + 2px)`,
        width: `calc(${100 / b.cols}% - 4px)`,
        ["--c" as string]: b.color,
      }}
      title={`${hm(b.startMin)} – ${hm(b.endMin)} · ${b.label}`}
    >
      <span className="th-block__time">
        {hm(b.startMin)} – {hm(b.endMin)}
      </span>
      <span className="th-block__label">{b.label}</span>
      {!compact && !short && b.posteLabel && b.posteLabel !== b.label && (
        <span className="th-block__poste">{b.posteLabel}</span>
      )}
      {b.mine && <span className="th-block__mine">Vous êtes en charge</span>}
    </div>
  );
}

function DayTimeline({
  blocks,
  nowMin,
}: {
  blocks: HomeBlock[];
  nowMin: number | null;
}) {
  if (blocks.length === 0)
    return (
      <p className="th-empty">
        Rien n&apos;est prévu au planning pour cette journée.
      </p>
    );
  const startHour = Math.floor(Math.min(...blocks.map((b) => b.startMin)) / 60);
  const endHour = Math.ceil(Math.max(...blocks.map((b) => b.endMin)) / 60);
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );
  const showNow =
    nowMin !== null && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const nowTop = showNow ? ((nowMin! - startHour * 60) / 60) * HOUR_PX : 0;

  return (
    <TimelineScroller initialTop={nowTop}>
      <div className="th-timeline" style={{ height: hours.length * HOUR_PX }}>
        {hours.map((h, i) => (
          <div key={h} className="th-hour" style={{ top: i * HOUR_PX }}>
            <span className="th-hour__label">{h}h</span>
          </div>
        ))}
        <div className="th-lane">
          {blocks.map((b) => (
            <Block key={b.id} b={b} startHour={startHour} />
          ))}
        </div>
        {showNow && (
          <div className="th-now" style={{ top: nowTop }}>
            <span>{hm(nowMin!)}</span>
          </div>
        )}
      </div>
    </TimelineScroller>
  );
}

export default function TraineeHome({
  firstName,
  data,
}: {
  firstName: string;
  data: TraineeHomeData;
}) {
  const {
    status,
    dayIndex,
    dayCount,
    dateLabel,
    startLabel,
    blocks,
    nowMin,
    lastEvaluation: ev,
  } = data;

  let dayTitle = "Aujourd'hui";
  let dayIntro: React.ReactNode = null;
  if (status === "during" && data.test) {
    dayIntro = (
      <>
        🧪 Session test · journée rejouée : Jour {dayIndex + 1} sur {dayCount}{" "}
        (prévu le {dateLabel})
      </>
    );
  } else if (status === "during") {
    dayIntro = (
      <>
        Jour {dayIndex + 1} sur {dayCount} ·{" "}
        <span className="th-cap">{dateLabel}</span>
      </>
    );
  } else if (status === "before") {
    dayTitle = "Premier jour";
    dayIntro = (
      <>
        La session commence le <span className="th-cap">{startLabel}</span>.
        Voici le programme du premier jour.
      </>
    );
  }

  return (
    <div className="th">
      <header className="th-head">
        <h1 className="th-title">Bonjour {firstName} 👋</h1>
        <p className="th-sub">{data.sessionName}</p>
      </header>

      <div className="th-grid">
        <section className="th-card">
          <div className="th-card__head">
            <div>
              <h2 className="th-card__title">{dayTitle}</h2>
              {dayIntro && <p className="th-card__sub">{dayIntro}</p>}
            </div>
            <Link href="/bafa?tab=planning" className="th-link">
              Planning complet →
            </Link>
          </div>
          {status === "nodate" && (
            <p className="th-empty">
              Les dates de la session ne sont pas encore fixées.
            </p>
          )}
          {status === "after" && (
            <p className="th-empty">
              La session est terminée. Le planning complet reste consultable
              dans l&apos;onglet Planning.
            </p>
          )}
          {(status === "during" || status === "before") && (
            <DayTimeline blocks={blocks} nowMin={nowMin} />
          )}
        </section>

        <section className="th-card th-card--eval">
          <div className="th-card__head">
            <h2 className="th-card__title">Ma dernière évaluation</h2>
          </div>
          {ev ? (
            <>
              <div
                className="th-eval__meta"
                style={{ ["--c" as string]: ev.color }}
              >
                <span className="th-eval__dot" aria-hidden />
                <div>
                  <p className="th-eval__label">{ev.label}</p>
                  <p className="th-eval__when">
                    Jour {ev.day + 1}
                    {ev.dateLabel && (
                      <>
                        {" "}
                        · <span className="th-cap">{ev.dateLabel}</span>
                      </>
                    )}{" "}
                    · {hm(ev.startMin)} – {hm(ev.endMin)}
                  </p>
                </div>
              </div>
              <p className="th-eval__note">{ev.note}</p>
              <Link href={`/bafa?tab=fiche&day=${ev.day}`} className="th-link">
                Toutes mes évaluations →
              </Link>
            </>
          ) : (
            <p className="th-empty">
              Pas encore d&apos;évaluation. Les retours de vos formateurs
              apparaîtront ici.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
