

import React from 'react'
import { useGLTF } from '@react-three/drei'

export function Model(props) {
  const { nodes, materials } = useGLTF('/clock-transformed.glb')
  return (
    <group {...props} dispose={null}>
      <mesh geometry={nodes.Object_2.geometry} material={materials['default']} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
      <mesh geometry={nodes.Object_4.geometry} material={materials.default_default_1_2} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
      <mesh geometry={nodes.Object_5.geometry} material={materials.default_default_1_5} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
      <mesh geometry={nodes.Object_6.geometry} material={materials.default_default_1_3} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
    </group>
  )
}

useGLTF.preload('/clock-transformed.glb')
