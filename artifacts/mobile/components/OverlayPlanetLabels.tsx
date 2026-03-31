import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Planet } from '@/context/GameContext';
import { Colors } from '@/constants/colors';

const FOG_RADIUS = 200;

function distToPlayerPlanets(px: number, py: number, planets: Planet[]): number {
  const pp = planets.filter(p => p.owner === 1);
  if (pp.length === 0) return Infinity;
  return Math.min(...pp.map(p => Math.hypot(p.x - px, p.y - py)));
}

interface Props {
  planets: Planet[];
  width: number;
  height: number;
}

export default function OverlayPlanetLabels({ planets, width, height }: Props) {
  const visiblePlanets = planets.filter(
    p => p.owner === 1 || distToPlayerPlanets(p.x, p.y, planets) < FOG_RADIUS
  );

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      {visiblePlanets.map(planet => {
        const color =
          planet.owner === 1
            ? Colors.playerPlanet
            : planet.owner === 2
            ? Colors.enemyPlanet
            : Colors.neutralPlanet;
        return (
          <View
            key={planet.id}
            style={[styles.label, { left: planet.x - 20, top: planet.y - 10 }]}
          >
            <Text style={[styles.text, { color }]}>{Math.floor(planet.units)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  label: {
    position: 'absolute',
    width: 40,
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
});
