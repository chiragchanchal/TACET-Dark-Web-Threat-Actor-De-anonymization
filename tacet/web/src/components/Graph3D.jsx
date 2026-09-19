import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Maximize2, RotateCw, Sparkles, Shield, KeyRound, Bitcoin, Globe, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils.js';

const KIND_CONFIG = {
  actor: {
    color: 0x22d3ee,
    emissive: 0x0891b2,
    label: 'Identity',
    size: 7.5,
    icon: Shield,
    geometry: (size) => new THREE.SphereGeometry(size, 24, 24),
  },
  crypto: {
    color: 0xfbbf24,
    emissive: 0xd97706,
    label: 'Wallet',
    size: 5.5,
    icon: Bitcoin,
    geometry: (size) => new THREE.OctahedronGeometry(size, 0),
  },
  pgp: {
    color: 0xf43f5e,
    emissive: 0xbe123c,
    label: 'PGP Key',
    size: 5.0,
    icon: KeyRound,
    geometry: (size) => new THREE.ConeGeometry(size * 0.9, size * 1.8, 5),
  },
  telegram: {
    color: 0x38bdf8,
    emissive: 0x0284c7,
    label: 'Telegram',
    size: 4.5,
    icon: MessageSquare,
    geometry: (size) => new THREE.SphereGeometry(size, 16, 16),
  },
  jabber: {
    color: 0x67e8f9,
    emissive: 0x06b6d4,
    label: 'Jabber/XMPP',
    size: 4.2,
    icon: MessageSquare,
    geometry: (size) => new THREE.SphereGeometry(size, 16, 16),
  },
  email: {
    color: 0xc084fc,
    emissive: 0x7e22ce,
    label: 'Email',
    size: 4.2,
    geometry: (size) => new THREE.BoxGeometry(size * 1.2, size * 0.8, size * 0.8),
  },
  url: {
    color: 0xa1a1aa,
    emissive: 0x52525b,
    label: 'Clearweb URL',
    size: 4.2,
    icon: Globe,
    geometry: (size) => new THREE.CylinderGeometry(size * 0.6, size * 0.6, size * 1.4, 8),
  },
  onion: {
    color: 0xf87171,
    emissive: 0xb91c1c,
    label: 'Onion Hidden Service',
    size: 4.5,
    geometry: (size) => new THREE.TetrahedronGeometry(size, 0),
  },
  alias: {
    color: 0x2dd4bf,
    emissive: 0x0d9488,
    label: 'Alias Handle',
    size: 4.2,
    geometry: (size) => new THREE.DodecahedronGeometry(size * 0.85, 0),
  },
  forum: {
    color: 0xa855f7,
    emissive: 0x6b21a8,
    label: 'Darknet Forum',
    size: 8.5,
    geometry: (size) => new THREE.IcosahedronGeometry(size, 0),
  },
};

const RISK_EMISSIVE = {
  CRITICAL: 0xef4444,
  HIGH: 0xf97316,
  MEDIUM: 0xfacc15,
  LOW: 0x34d399,
};

export function Graph3D({
  data,
  selectedId,
  onSelectNode,
  kinds,
  searchQuery = '',
  height = 680,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);
  const nodesMapRef = useRef(new Map());
  const edgesArrayRef = useRef([]);
  const pulseParticlesRef = useRef([]);
  const targetCamPosRef = useRef(null);
  const targetLookAtRef = useRef(null);

  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, node: null });
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeCount, setActiveCount] = useState({ nodes: 0, edges: 0 });

  // Filter nodes & edges based on active kinds and search query
  const filteredGraph = useMemo(() => {
    if (!data?.nodes) return { nodes: [], edges: [] };
    const q = searchQuery.trim().toLowerCase();
    const activeNodes = data.nodes.filter((n) => {
      if (kinds && !kinds.has(n.kind)) return false;
      if (q) {
        const matchLabel = String(n.label || '').toLowerCase().includes(q);
        const matchDetail = String(n.address || n.keyId || n.handle || '').toLowerCase().includes(q);
        if (!matchLabel && !matchDetail) return false;
      }
      return true;
    });
    const idSet = new Set(activeNodes.map((n) => n.id));
    const activeEdges = (data.edges || []).filter(
      (e) => idSet.has(e.source) && idSet.has(e.target)
    );
    return { nodes: activeNodes, edges: activeEdges };
  }, [data, kinds, searchQuery]);

  // Adjacency for ego highlighting
  const adjacency = useMemo(() => {
    const map = new Map();
    for (const e of filteredGraph.edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source).add(e.target);
      map.get(e.target).add(e.source);
    }
    return map;
  }, [filteredGraph]);

  // Reset Camera View
  const resetCamera = useCallback(() => {
    if (!controlsRef.current || !sceneRef.current) return;
    targetCamPosRef.current = new THREE.Vector3(0, 180, 480);
    targetLookAtRef.current = new THREE.Vector3(0, 0, 0);
  }, []);

  // Main Three.js Scene Setup & Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 980;
    const h = height;

    // 1. Scene & Fog (atmospheric cyber depth)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06070a);
    scene.fog = new THREE.FogExp2(0x06070a, 0.0012);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / h, 1, 3000);
    camera.position.set(0, 200, 490);

    // 3. Renderer with antialias and tone mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 60;
    controls.maxDistance = 1400;
    controls.maxPolarAngle = Math.PI / 2 + 0.08; // slight tilt below horizon
    controls.autoRotateSpeed = 0.6;
    controlsRef.current = controls;

    // 5. Lighting Setup (Crafted for crisp geometric highlights and glowing emissives)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight1.position.set(200, 350, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x818cf8, 0.7);
    dirLight2.position.set(-250, -100, -200);
    scene.add(dirLight2);

    const centerPointLight = new THREE.PointLight(0x22d3ee, 1.5, 600, 1.2);
    centerPointLight.position.set(0, 20, 0);
    scene.add(centerPointLight);

    // 6. Holographic Ground Grid & Radar Concentric Rings
    const gridHelper = new THREE.GridHelper(900, 45, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -130;
    scene.add(gridHelper);

    // Concentric tactical rings on ground
    const ringGroup = new THREE.Group();
    ringGroup.position.y = -129.5;
    ringGroup.rotation.x = -Math.PI / 2;
    [100, 220, 360].forEach((radius) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.7, radius + 0.7, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      });
      ringGroup.add(new THREE.Mesh(ringGeo, ringMat));
    });
    scene.add(ringGroup);

    // 7. Ambient Particle Nebula (starfield dust)
    const particleCount = 750;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 1200;
      particlePositions[i + 1] = (Math.random() - 0.5) * 600;
      particlePositions[i + 2] = (Math.random() - 0.5) * 1200;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 2.2,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Raycasting for interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshList = [];
      nodesMapRef.current.forEach((val) => meshList.push(val.mesh));
      const intersects = raycaster.intersectObjects(meshList, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const hitNode = hitMesh.userData?.node;
        if (hitNode) {
          setHoveredNode(hitNode.id);
          setTooltip({
            visible: true,
            x: e.clientX - rect.left + 16,
            y: e.clientY - rect.top - 12,
            node: hitNode,
          });
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredNode(null);
      setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      container.style.cursor = 'grab';
    };

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshList = [];
      nodesMapRef.current.forEach((val) => meshList.push(val.mesh));
      const intersects = raycaster.intersectObjects(meshList, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const hitNode = hitMesh.userData?.node;
        if (hitNode) {
          onSelectNode?.(hitNode.id);
          // Fly camera toward target
          targetLookAtRef.current = hitMesh.position.clone();
          targetCamPosRef.current = hitMesh.position.clone().add(new THREE.Vector3(0, 35, 140));
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && camera && renderer) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    // 8. Render & Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth camera fly-to interpolation
      if (targetCamPosRef.current && targetLookAtRef.current) {
        camera.position.lerp(targetCamPosRef.current, 0.07);
        controls.target.lerp(targetLookAtRef.current, 0.07);
        if (camera.position.distanceTo(targetCamPosRef.current) < 2) {
          targetCamPosRef.current = null;
          targetLookAtRef.current = null;
        }
      }

      controls.update();

      // Slow idle rotation of node rings & meshes
      nodesMapRef.current.forEach((item) => {
        if (item.ring) item.ring.rotation.z += 0.015;
        if (item.secondaryRing) item.secondaryRing.rotation.y += 0.012;
        if (item.mesh) {
          if (item.node.kind === 'crypto' || item.node.kind === 'forum') {
            item.mesh.rotation.y += 0.008;
            item.mesh.rotation.x += 0.004;
          }
        }
      });

      // Animate flowing data pulses along edges
      pulseParticlesRef.current.forEach((pulse) => {
        pulse.t = (pulse.t + delta * pulse.speed) % 1;
        if (pulse.curve) {
          const pt = pulse.curve.getPoint(pulse.t);
          pulse.mesh.position.copy(pt);
        }
      });

      // Subtle slow background particle drift
      particleSystem.rotation.y = time * 0.015;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      controls.dispose();
    };
  }, [height, onSelectNode]);

  // Handle AutoRotate toggle
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Construct 3D Graph Nodes, Edges, Splines, and Pulses
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Find and clear existing graph objects
    const toRemove = [];
    scene.children.forEach((child) => {
      if (child.userData?.isGraphElement) toRemove.push(child);
    });
    toRemove.forEach((c) => {
      scene.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material.dispose();
      }
    });

    const nodes = filteredGraph.nodes;
    const edges = filteredGraph.edges;
    setActiveCount({ nodes: nodes.length, edges: edges.length });

    if (!nodes.length) {
      nodesMapRef.current.clear();
      edgesArrayRef.current = [];
      pulseParticlesRef.current = [];
      return;
    }

    const N = nodes.length;
    const nodePositions = new Map();
    const nodesMap = new Map();

    // Compute 3D Spatial Layout (Multi-tier stratified phyllotaxis with organic spherical elevation)
    const cx = 0; const cy = 10; const cz = 0;
    const radiusSpread = Math.min(320, 75 + Math.sqrt(N) * 16);

    nodes.forEach((n, i) => {
      const isActor = n.kind === 'actor';
      const a = i * 2.399963; // Golden angle
      const r = radiusSpread * Math.sqrt((i + 1) / N);
      let x = cx + Math.cos(a) * r;
      let z = cz + Math.sin(a) * r;

      // 3D elevation based on entity identity & threat severity
      let y = cy;
      if (isActor) {
        const scoreBonus = ((n.score || n.attributionScore || 0) / 100) * 45;
        const riskElev = { CRITICAL: 42, HIGH: 24, MEDIUM: 6, LOW: -12 }[n.risk] || 0;
        y += riskElev + scoreBonus;
      } else if (n.kind === 'forum') {
        y += 65 + (i % 3) * 15;
      } else if (n.kind === 'crypto') {
        y += -25 + (Math.sin(i) * 20);
      } else if (n.kind === 'pgp') {
        y += 15 + (Math.cos(i) * 25);
      } else {
        y += (Math.sin(a * 2) * 28);
      }

      const pos = new THREE.Vector3(x, y, z);
      nodePositions.set(n.id, pos);
    });

    // Create 3D Node Meshes & Craft Specific Geometry per Entity
    const graphGroup = new THREE.Group();
    graphGroup.userData = { isGraphElement: true };

    nodes.forEach((n) => {
      const pos = nodePositions.get(n.id);
      const conf = KIND_CONFIG[n.kind] || KIND_CONFIG.url;
      const isActor = n.kind === 'actor';

      let size = conf.size;
      if (isActor) {
        const scoreNorm = (n.score || n.attributionScore || 0) / 100;
        size = 7.0 + scoreNorm * 5.5;
      }

      // Material Direction: Physically-based phong/standard shader with emissive glow
      const meshGeo = conf.geometry(size);
      let emissiveColor = conf.emissive;
      if (isActor && n.risk && RISK_EMISSIVE[n.risk]) {
        emissiveColor = RISK_EMISSIVE[n.risk];
      }

      const meshMat = new THREE.MeshStandardMaterial({
        color: conf.color,
        emissive: emissiveColor,
        emissiveIntensity: isActor ? 0.55 : 0.35,
        roughness: n.kind === 'crypto' ? 0.22 : 0.45,
        metalness: n.kind === 'crypto' ? 0.85 : 0.25,
      });

      const mesh = new THREE.Mesh(meshGeo, meshMat);
      mesh.position.copy(pos);
      mesh.userData = { id: n.id, node: n };
      graphGroup.add(mesh);

      let ring = null;
      let secondaryRing = null;

      // Object Craft: Hero identities receive outer orbital telemetry rings
      if (isActor) {
        const ringGeo = new THREE.RingGeometry(size * 1.55, size * 1.75, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: emissiveColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        });
        ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.3;
        mesh.add(ring);

        // Secondary orthogonal accent ring for high-risk actors
        if (n.risk === 'CRITICAL' || n.risk === 'HIGH') {
          const secRingGeo = new THREE.RingGeometry(size * 1.9, size * 2.05, 32);
          const secRingMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.28,
          });
          secondaryRing = new THREE.Mesh(secRingGeo, secRingMat);
          secondaryRing.rotation.y = Math.PI / 3;
          mesh.add(secondaryRing);
        }
      }

      nodesMap.set(n.id, { mesh, ring, secondaryRing, node: n, baseScale: 1.0 });
    });

    // Create 3D Curved Connections (CatmullRom Splines) & Flowing Data Pulses
    const edgesList = [];
    const pulseList = [];

    edges.forEach((e) => {
      const pA = nodePositions.get(e.source);
      const pB = nodePositions.get(e.target);
      if (!pA || !pB) return;

      // Compute gentle upward mid-arch for organic 3D curve
      const mid = pA.clone().add(pB).multiplyScalar(0.5);
      const dist = pA.distanceTo(pB);
      mid.y += Math.min(35, dist * 0.18);

      const curve = new THREE.CatmullRomCurve3([pA, mid, pB]);
      const points = curve.getPoints(24);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

      const isStrong = (e.weight || 0) > 0.75;
      const lineMat = new THREE.LineBasicMaterial({
        color: isStrong ? 0x22d3ee : 0x334155,
        transparent: true,
        opacity: isStrong ? 0.75 : 0.35,
        depthWrite: false,
      });

      const line = new THREE.Line(lineGeo, lineMat);
      line.userData = { source: e.source, target: e.target, weight: e.weight };
      graphGroup.add(line);
      edgesList.push({ line, source: e.source, target: e.target, curve });

      // Moving cyber data pulse along strong or active links
      if (isStrong || Math.random() < 0.45) {
        const pulseGeo = new THREE.SphereGeometry(1.4, 8, 8);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.95,
        });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        graphGroup.add(pulseMesh);
        pulseList.push({
          mesh: pulseMesh,
          curve,
          t: Math.random(),
          speed: 0.22 + Math.random() * 0.24,
        });
      }
    });

    scene.add(graphGroup);
    nodesMapRef.current = nodesMap;
    edgesArrayRef.current = edgesList;
    pulseParticlesRef.current = pulseList;
  }, [filteredGraph]);

  // Handle Node Focus / Ego Highlight on Hover or Select
  useEffect(() => {
    const focusId = hoveredNode || selectedId;
    const focusNeighbors = focusId ? adjacency.get(focusId) || new Set() : null;

    nodesMapRef.current.forEach((item, id) => {
      const isFocused = id === focusId;
      const isNeighbor = focusNeighbors ? focusNeighbors.has(id) : false;
      const inEgo = isFocused || isNeighbor;

      const targetScale = isFocused ? 1.45 : isNeighbor ? 1.15 : 1.0;
      item.mesh.scale.set(targetScale, targetScale, targetScale);

      // Emissive and opacity modulation
      if (focusId) {
        if (inEgo) {
          item.mesh.material.opacity = 1.0;
          item.mesh.material.transparent = false;
          item.mesh.material.emissiveIntensity = isFocused ? 1.2 : 0.65;
        } else {
          item.mesh.material.transparent = true;
          item.mesh.material.opacity = 0.22;
          item.mesh.material.emissiveIntensity = 0.1;
        }
      } else {
        item.mesh.material.transparent = false;
        item.mesh.material.opacity = 1.0;
        item.mesh.material.emissiveIntensity = item.node.kind === 'actor' ? 0.55 : 0.35;
      }
    });

    // Dim or highlight connection lines
    edgesArrayRef.current.forEach(({ line, source, target }) => {
      if (focusId) {
        const connected =
          (source === focusId && focusNeighbors?.has(target)) ||
          (target === focusId && focusNeighbors?.has(source));
        if (connected) {
          line.material.color.setHex(0x22d3ee);
          line.material.opacity = 0.95;
        } else {
          line.material.color.setHex(0x1e293b);
          line.material.opacity = 0.08;
        }
      } else {
        const isStrong = (line.userData?.weight || 0) > 0.75;
        line.material.color.setHex(isStrong ? 0x22d3ee : 0x334155);
        line.material.opacity = isStrong ? 0.75 : 0.35;
      }
    });
  }, [hoveredNode, selectedId, adjacency]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#06070a] shadow-2xl">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full select-none cursor-grab active:cursor-grabbing" style={{ height }} />

      {/* Tactical HUD Header Bar */}
      <div className="pointer-events-none absolute top-3.5 left-4 flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-black/70 px-3 py-1.5 backdrop-blur-md">
          <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span className="font-mono text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
            3D Threat Constellation
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-white/5 bg-black/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-400 backdrop-blur-md">
          <span className="text-zinc-200 font-bold">{activeCount.nodes}</span> nodes
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-200 font-bold">{activeCount.edges}</span> links
        </div>
      </div>

      {/* Floating Tactical Tooltip */}
      {tooltip.visible && tooltip.node && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-cyan-500/40 bg-[#0c1017]/95 p-3 shadow-2xl backdrop-blur-md transition-all duration-75 text-zinc-100"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shadow-sm"
              style={{
                backgroundColor: `#${(KIND_CONFIG[tooltip.node.kind]?.color || 0x22d3ee).toString(16).padStart(6, '0')}`,
              }}
            />
            <span className="font-mono text-[12px] font-bold text-zinc-100">
              {tooltip.node.label || tooltip.node.id}
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-px text-[9.5px] uppercase tracking-wider text-zinc-400">
              {KIND_CONFIG[tooltip.node.kind]?.label || tooltip.node.kind}
            </span>
          </div>
          {tooltip.node.risk && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="text-zinc-500">Risk posture:</span>
              <span
                className={cn(
                  'font-semibold uppercase tracking-wider',
                  tooltip.node.risk === 'CRITICAL' && 'text-red-400',
                  tooltip.node.risk === 'HIGH' && 'text-orange-400',
                  tooltip.node.risk === 'MEDIUM' && 'text-amber-400',
                  tooltip.node.risk === 'LOW' && 'text-emerald-400'
                )}
              >
                {tooltip.node.risk}
              </span>
              {(tooltip.node.score || tooltip.node.attributionScore) && (
                <span className="font-mono text-cyan-300">
                  ({tooltip.node.score || tooltip.node.attributionScore}%)
                </span>
              )}
            </div>
          )}
          {tooltip.node.address && (
            <div className="mt-1 font-mono text-[10.5px] text-amber-300/90 truncate max-w-[240px]">
              {tooltip.node.address}
            </div>
          )}
          <div className="mt-1.5 text-[10px] text-zinc-500 flex items-center gap-1.5 border-t border-white/5 pt-1.5">
            <span>Click to inspect & lock camera</span>
          </div>
        </div>
      )}

      {/* Tactical HUD Controls (Bottom-left & Bottom-right) */}
      <div className="absolute bottom-3.5 left-4 flex items-center gap-2">
        <button
          onClick={() => setAutoRotate((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-medium transition-all backdrop-blur-md',
            autoRotate
              ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-lg shadow-cyan-500/10'
              : 'border-white/10 bg-black/60 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
          )}
          title="Toggle automatic orbital rotation"
        >
          <RotateCw className={cn('h-3.5 w-3.5', autoRotate && 'animate-spin')} />
          <span>Auto-Orbit</span>
        </button>
        <button
          onClick={resetCamera}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 font-mono text-[11px] font-medium text-zinc-400 transition-all hover:border-white/20 hover:text-zinc-200 backdrop-blur-md"
          title="Reset camera viewpoint"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Reset Frame</span>
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3.5 right-4 hidden md:flex items-center gap-3 rounded-lg border border-white/5 bg-black/60 px-3 py-1.5 font-mono text-[10.5px] text-zinc-500 backdrop-blur-md">
        <span>LEFT-DRAG: ORBIT</span>
        <span>·</span>
        <span>RIGHT-DRAG: PAN</span>
        <span>·</span>
        <span>SCROLL: ZOOM</span>
      </div>
    </div>
  );
}
