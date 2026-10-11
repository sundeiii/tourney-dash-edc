import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import {
  useEdcCurrentMatch,
  useEdcMemberStats,
  type EdcEntrant,
  type EdcMemberStats,
} from "~/state/centaurea";

const formatNumber = (n: number | null | undefined, prefix = "") =>
  n == null ? "—" : `${prefix}${Math.round(n).toLocaleString("en-US")}`;

const formatAccuracy = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(2)}%`;

type TeamColumnProps = {
  team: EdcEntrant;
  side: "red" | "blue";
  stats: Map<string, EdcMemberStats>;
};

function TeamColumn({ team, side, stats }: TeamColumnProps) {
  return (
    <div className={`pi-team ${side}`}>
      <div className="pi-team-header">
        <div className="pi-team-avatar">
          <img src={team.avatarUrl} />
        </div>
        <div className="pi-team-text">
          <FitText className="pi-team-name">{team.name}</FitText>
          {team.seed && (
            <div className="pi-team-seed">
              <span className="player-info-label">Seed </span>
              {team.seed}
            </div>
          )}
        </div>
      </div>

      {team.members.map((member) => {
        const s = stats.get(member.id);
        return (
          <div className="pi-member" key={member.id}>
            <div className="pi-member-avatar">
              <img src={member.avatarUrl} />
            </div>
            <div className="pi-member-info">
              <FitText className="pi-member-name">{member.name}</FitText>
              <div className="pi-stats">
                <div>
                  <div className="pi-stat-label">Global</div>
                  <div className="pi-stat-value">
                    {formatNumber(s?.globalRank, "#")}
                  </div>
                </div>
                <div>
                  <div className="pi-stat-label">Country</div>
                  <div className="pi-stat-value">
                    {formatNumber(s?.countryRank, "#")}
                  </div>
                </div>
                <div>
                  <div className="pi-stat-label">PP</div>
                  <div className="pi-stat-value">{formatNumber(s?.pp)}</div>
                </div>
                <div>
                  <div className="pi-stat-label">Accuracy</div>
                  <div className="pi-stat-value">
                    {formatAccuracy(s?.accuracy)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PlayerInfoScreenProps {
  from?: string;
  to: string;
}

export function PlayerInfoScreen({ from, to }: PlayerInfoScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;

  const { red, blue, roundName, bracketLabel } = useEdcCurrentMatch();
  const stats = useEdcMemberStats(
    [...red.members, ...blue.members].map((m) => m.id),
  );

  return (
    <div id="main">
      <motion.div
        key={`main-${to}`}
        {...(anims.main === "slide"
          ? sectionVariants.main.slide(slideDirection)
          : anims.main === "fade"
            ? sectionVariants.main.fade
            : sectionVariants.main.none)}
      >
        <MainContent>
          <div id="pi-teams">
            <TeamColumn team={red} side="red" stats={stats} />
            <div id="pi-vs">VS</div>
            <TeamColumn team={blue} side="blue" stats={stats} />
          </div>
          <div id="pi-stage">
            {roundName}
            {bracketLabel && <span className="pi-stage-label"> · {bracketLabel}</span>}
          </div>
        </MainContent>
      </motion.div>
    </div>
  );
}
