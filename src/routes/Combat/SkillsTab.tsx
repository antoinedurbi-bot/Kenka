import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { skillsLevel } from "../../lib/progression";
import { Bar, SectionTitle, Stat } from "../../components/ui";
import { SkillTree } from "./SkillTree";

export function SkillsTab() {
  const skills = useLiveQuery(() => db.combatSkills.toArray(), []) ?? [];
  const checkpoints = useLiveQuery(() => db.combatCheckpoints.toArray(), []) ?? [];

  const level = skillsLevel(checkpoints);
  const done = checkpoints.filter((c) => c.achieved).length;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="k-label text-blood-500">Rang Ippo</div>
            <div className="font-display text-2xl uppercase tracking-[0.04em] text-bone-50">
              {level.title}
            </div>
          </div>
          <Stat label="Checkpoints" value={`${done}/${checkpoints.length}`} tone="blood" />
        </div>
        <Bar
          value={level.levelMax ? (level.level + level.progress) / level.levelMax : 0}
          tone="blood"
          className="mt-3"
        />
      </section>

      <p className="text-xs text-bone-600">Chaque palier se valide à la main, honnêtement.</p>

      <SectionTitle>Branches</SectionTitle>
      <div className="space-y-4">
        {skills.map((skill) => (
          <SkillTree
            key={skill.id}
            skill={skill}
            checkpoints={checkpoints.filter((c) => c.skillId === skill.id)}
          />
        ))}
      </div>
    </div>
  );
}
