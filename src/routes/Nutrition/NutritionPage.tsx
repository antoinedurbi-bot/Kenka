import { PageHeader } from "../../components/layout/Shell";
import { NutritionTab } from "../Physique/NutritionTab";

/**
 * Nutrition vivait comme un onglet de Physique, au même niveau que Volume ou
 * Mesures — mais on ne la consulte pas au même moment : une séance se
 * regarde avant de s'entraîner, la nutrition se regarde en fin de journée,
 * après la pesée. Deux rythmes différents méritent deux tuiles du hub.
 */
export function NutritionPage() {
  return (
    <>
      <PageHeader eyebrow="Axe I — Toji" title="Nutrition">
        Le maintien se mesure, il ne se calcule pas. Poids et apports suffisent — le reste en
        découle.
      </PageHeader>
      <NutritionTab />
    </>
  );
}
