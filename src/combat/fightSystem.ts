import type { Combatant, EventBus } from '../contracts';
import { HIT_FROM, HIT_TO, HURT_TICKS, PARRY_FROM, PARRY_TO, PUSHBACK_PX, REACH_PX, STAGGER_TICKS, SWORD_DAMAGE } from './constants';

/**
 * Resolves sword blows between combatants once per tick, after everyone has updated.
 * A strike connects at most once, during its hit window, on the nearest foe in front.
 */
export class FightSystem {
  constructor(private readonly bus?: EventBus) {}

  update(fighters: readonly Combatant[]): void {
    for (const a of fighters) {
      if (a.hp <= 0 || a.fightAction !== 'strike' || a.strikeConnected) continue;
      if (a.fightFrame < HIT_FROM || a.fightFrame > HIT_TO) continue;
      const foe = this.target(a, fighters);
      if (!foe) continue;
      a.strikeConnected = true;
      const parried =
        foe.fightAction === 'parry' && foe.fightFrame >= PARRY_FROM && foe.fightFrame <= PARRY_TO && foe.facing === -a.facing;
      if (parried) {
        // The riposte window: the attacker is thrown off balance, the defender is not.
        a.pushBack(-a.facing * PUSHBACK_PX);
        a.stagger(STAGGER_TICKS);
        this.bus?.emit('sfx:play', { key: 'parry' });
        continue;
      }
      foe.applyDamage({ target: foe.id, amount: SWORD_DAMAGE, source: 'sword' });
      foe.pushBack(a.facing * PUSHBACK_PX);
      if (foe.hp > 0) foe.stagger(HURT_TICKS);
      this.bus?.emit('sfx:play', { key: 'hit' });
    }
  }

  private target(a: Combatant, fighters: readonly Combatant[]): Combatant | undefined {
    let best: Combatant | undefined;
    let bestDist = Infinity;
    for (const f of fighters) {
      if (f.team === a.team || f.hp <= 0 || f.ty !== a.ty) continue;
      const d = (f.x - a.x) * a.facing;
      if (d <= 0 || d > REACH_PX || d >= bestDist) continue;
      best = f;
      bestDist = d;
    }
    return best;
  }
}
