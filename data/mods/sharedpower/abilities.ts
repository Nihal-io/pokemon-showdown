export const Abilities: import('../../../sim/dex-abilities').ModdedAbilityDataTable = {
	neutralizinggas: {
		inherit: true,
		// Ability suppression implemented in sim/pokemon.ts:Pokemon#ignoringAbility
		onSwitchIn(pokemon) {
			this.add('-ability', pokemon, 'Neutralizing Gas');
			pokemon.abilityState.ending = false;
			// Remove setter's innates before the ability starts
			for (const target of this.getAllActive()) {
				if (target.illusion) {
					this.singleEvent('End', this.dex.abilities.get('Illusion'), target.abilityState, target, pokemon, 'neutralizinggas');
				}
				if (target.volatiles['slowstart']) {
					delete target.volatiles['slowstart'];
					this.add('-end', target, 'Slow Start', '[silent]');
				}
				if (target.m.abils?.length) {
					for (const key of target.m.abils) {
						if (this.dex.abilities.get(key.slice(8)).flags['cantsuppress']) continue;
						target.removeVolatile(key);
					}
				}
			}
		},
		onEnd(source) {
			this.add('-end', source, 'ability: Neutralizing Gas');

			// FIXME this happens before the pokemon switches out, should be the opposite order.
			// Not an easy fix since we cant use a supported event. Would need some kind of special event that
			// gathers events to run after the switch and then runs them when the ability is no longer accessible.
			// (If you're tackling this, do note extreme weathers have the same issue)

			// Mark this pokemon's ability as ending so Pokemon#ignoringAbility skips it
			if (source.abilityState.ending) return;
			source.abilityState.ending = true;
			const sortedActive = this.getAllActive();
			this.speedSort(sortedActive);
			for (const pokemon of sortedActive) {
				if (pokemon !== source) {
					// Will be suppressed by Pokemon#ignoringAbility if needed
					this.singleEvent('Start', pokemon.getAbility(), pokemon.abilityState, pokemon);
				}
				if (pokemon.m.abils?.length) {
					for (const innate of pokemon.m.abils) {
						// permanent abilities
						if (pokemon.volatiles[innate]) continue;
						pokemon.addVolatile(innate, pokemon);
					}
				}
			}
		},
	},
	trace: {
		inherit: true,
		onUpdate(pokemon) {
			if (!this.effectState.seek) return;
			const isAbility = pokemon.ability === 'trace';

			const possibleTargets = pokemon.adjacentFoes().filter(
				target => !target.getAbility().flags['notrace'] && target.ability !== 'noability'
			);
			if (!possibleTargets.length) return;

			const target = this.sample(possibleTargets);
			const ability = target.getAbility();

			if (isAbility) {
				if (pokemon.setAbility(ability)) {
					this.add('-ability', pokemon, ability, '[from] ability: Trace', `[of] ${target}`);
				}
			} else {
				pokemon.removeVolatile('ability:trace');
				pokemon.addVolatile('ability:' + ability.id, pokemon);
				this.add('-ability', pokemon, ability, '[from] ability: Trace', `[of] ${target}`);
			}
		},
	},
	wimpout: {
		inherit: true,
		onEmergencyExit(target) {
			if (!this.canSwitch(target.side) || target.forceSwitchFlag || target.switchFlag) return;

			// This guard is there to prevent infinite forced switches caused by Wimp Out/Emergency Exit and Regenerator
			// The idea is to store the state of the side everytime this ability is triggered and check if the same state was reached previously
			// Since the simulator is a deterministic state machine, if the same state is reached previously, then the same actions taken will lead to same outcome
			// It returns prematurely if the same state is reached previously and auto clears itself each turn
			const side = target.side as any;
			if (!side.visitedStates || side.visitedStatesTurn !== this.turn) {
				side.visitedStates = new Set();
				side.visitedStatesTurn = this.turn;
			}
			const state = this.sides.map(s => {
				for (const [i, mon] of s.pokemon.entries()) {
					if (mon.m.loopKey === undefined) mon.m.loopKey = i;
				}
				return s.pokemon
					.map(p => `${p.m.loopKey}:${p.hp}:${s.active.includes(p) ? 1 : 0}`)
					.sort()
					.join(',');
			}).join('|');
			if (side.visitedStates.has(state)) { return; }
			side.visitedStates.add(state);

			for (const otherside of this.sides) {
				for (const active of otherside.active) {
					active.switchFlag = false;
				}
			}
			target.switchFlag = true;
			this.add('-activate', target, 'ability: Wimp Out');
		},
	},
	emergencyexit: {
		inherit: true,
		onEmergencyExit(target) {
			if (!this.canSwitch(target.side) || target.forceSwitchFlag || target.switchFlag) return;

			const side = target.side as any;
			if (!side.visitedStates || side.visitedStatesTurn !== this.turn) {
				side.visitedStates = new Set();
				side.visitedStatesTurn = this.turn;
			}
			const state = this.sides.map(s => {
				for (const [i, mon] of s.pokemon.entries()) {
					if (mon.m.loopKey === undefined) mon.m.loopKey = i;
				}
				return s.pokemon
					.map(p => `${p.m.loopKey}:${p.hp}:${s.active.includes(p) ? 1 : 0}`)
					.sort()
					.join(',');
			}).join('|');

			if (side.visitedStates.has(state)) { return; }
			side.visitedStates.add(state);
			for (const otherside of this.sides) {
				for (const active of otherside.active) {
					active.switchFlag = false;
				}
			}
			target.switchFlag = true;
			this.add('-activate', target, 'ability: Emergency Exit');
		},
	},
};
