import type { BoardTierId, ManagerNewsItem } from "./types.ts";

export type NewsDraft = Omit<ManagerNewsItem, "id" | "s" | "w">;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildSeasonStartNews(params: {
  teamName: string;
  season: number;
  coachName: string;
  ovr: number;
  diffLabel: string;
  tier: BoardTierId;
  objectiveLabel: string;
}): NewsDraft {
  const { teamName, season, coachName, ovr, diffLabel, tier, objectiveLabel } = params;

  if (tier === "giant") {
    return {
      cat: "OFICIAL",
      source: "VLR.GG PORTADA",
      headline: `${teamName} arranca ${season} bajo presión máxima: solo valen trofeos`,
      body: `La directiva de ${teamName} (OVR ${ovr.toFixed(1)}) presentó oficialmente su proyecto ${season} en dificultad ${diffLabel} junto a DT ${coachName}. En un club de esta envergadura no existe margen para temporadas de transición: la cúpula fijó una hoja de ruta implacable (${objectiveLabel}). Analistas de la escena ya advierten que una campaña sin vitrina nueva dejaría al banquillo sin respaldo, sin importar el récord en fase regular.`,
      quote: `"Aquí no se celebra competir bien; si al cerrar el año no hay un trofeo en la vitrina, el proyecto habrá fracasado." — Mesa de Análisis VCT`,
      teams: [teamName],
      hot: true
    };
  }

  if (tier === "contender") {
    return {
      cat: "OFICIAL",
      source: "VLR.GG PORTADA",
      headline: `${teamName} apunta al salto internacional en la temporada ${season}`,
      body: `Con un quinteto valorado en ${ovr.toFixed(1)} OVR y DT ${coachName} en el cuerpo técnico, ${teamName} abre la campaña ${season} (${diffLabel}) con el reto de consolidarse entre la élite global. La directiva trazó una exigencia concreta: ${objectiveLabel}. Hay margen para pulir el roster durante el año, pero quedar fuera de las citas internacionales pondrá a prueba la paciencia de los despachos.`,
      quote: `"Tienen pólvora suficiente para pelear finales regionales; su verdadero examen será mantener la consistencia en cada Masters." — Panel Táctico VLR`,
      teams: [teamName],
      hot: false
    };
  }

  return {
    cat: "OFICIAL",
    source: "SPIKE.GG ANÁLISIS",
    headline: `${teamName} apuesta por reconstrucción inteligente y cantera en ${season}`,
    body: `Lejos de las promesas irreales, ${teamName} (OVR ${ovr.toFixed(1)}) inauguró su proyecto ${season} (${diffLabel}) junto a DT ${coachName} con una hoja de ruta sostenible. La directiva exige paso firme sin hipotecar el futuro: ${objectiveLabel}. Varios ojeadores destacan que dar minutos de titular a una promesa de la Academia puede ser el diferencial que convierta a este proyecto en la revelación del año.`,
    quote: `"Si logran meterse en Playoffs cuidando la caja y fogueando a un juvenil, nadie querrá cruzarlos en Stage 2." — Scouting Desk`,
    teams: [teamName],
    hot: false
  };
}

export function buildMatchUpsetNews(params: {
  winner: string;
  loser: string;
  wOvr: number;
  lOvr: number;
  scoreTxt: string;
  label: string;
  mapsLine: string;
  mvpName?: string;
  mvpRating?: string;
  mvpAcs?: number;
  winnerCoach: string;
  loserCoach: string;
}): NewsDraft {
  const {
    winner,
    loser,
    wOvr,
    lOvr,
    scoreTxt,
    label,
    mapsLine,
    mvpName,
    mvpRating,
    mvpAcs,
    winnerCoach,
    loserCoach
  } = params;

  const mvpClause = mvpName
    ? ` ${mvpName} comandó la gesta con ${mvpRating} de Rating 2.0 y ${mvpAcs} ACS, desarmando cada ajuste defensivo rival.`
    : "";

  const variants: NewsDraft[] = [
    {
      cat: "UPSET",
      source: "VLR.GG CRÓNICA",
      headline: `BATACAZO EN ${label.toUpperCase()}: ${winner} tumba a ${loser} (${scoreTxt})`,
      body: `Nadie lo tenía en sus pick'ems. ${winner} (OVR ${wOvr}) ejecutó un plan táctico impecable para despachar al favorito ${loser} (OVR ${lOvr}) con parciales de ${mapsLine}.${mvpClause} El veto preparado por DT ${winnerCoach} dejó sin respuestas a ${loserCoach} en las rondas clave de economía.`,
      quote: `"Subestimar a ${winner} en este map pool es un error que hoy ${loser} pagó carísimo." — Transmisión Oficial VCT`,
      teams: [winner, loser],
      hot: true
    },
    {
      cat: "UPSET",
      source: "MESA DE CASTERS",
      headline: `Terremoto competitivo: ${winner} desnuda a ${loser} en un ${scoreTxt} inolvidable`,
      body: `La diferencia de talento sobre el papel (${wOvr} frente a ${lOvr} OVR) quedó borrada desde la primera mitad. ${winner} leyó los timings de ${loser} a la perfección en ${label} (${mapsLine}) y castigó cada sobreextensión en mid-round.${mvpClause} En los foros ya se debate si ${loser} entró excesivamente confiado a la serie.`,
      quote: `"Cada timeout de DT ${winnerCoach} cambió el ritmo del mapa; fue una clase magistral de anti-strat." — Análisis Post-Partido`,
      teams: [winner, loser],
      hot: true
    }
  ];

  return pick(variants);
}

export function buildMatchStarNews(params: {
  playerName: string;
  playerRole: string;
  playerTeam: string;
  oppTeam: string;
  rating: string;
  acs: number;
  kda: string;
  scoreTxt: string;
  label: string;
  mapsLine: string;
  won: boolean;
}): NewsDraft {
  const { playerName, playerRole, playerTeam, oppTeam, rating, acs, kda, scoreTxt, label, mapsLine, won } =
    params;

  if (!won) {
    return {
      cat: "OFICIAL",
      source: "VLR.GG ESTADÍSTICAS",
      headline: `Exhibición en solitario de ${playerName} (${rating} R2.0), insuficiente ante ${oppTeam}`,
      body: `Aunque ${playerTeam} cayó frente a ${oppTeam} (${scoreTxt} en ${label}; ${mapsLine}), la actuación individual de ${playerName} acaparó todos los focos. Desde el rol de ${playerRole} registró ${acs} ACS y una línea de ${kda}, cargando con el peso de los duelos de apertura y los clutches. La comunidad ya señala que el resto del quinteto deberá acompañar ese nivel cuanto antes.`,
      quote: `"Es casi imposible hacer más en un servidor y terminar perdiendo la serie." — Panel de Estadísticas`,
      teams: [playerTeam, oppTeam],
      hot: false
    };
  }

  return pick<NewsDraft>([
    {
      cat: "OFICIAL",
      source: "VLR.GG MVP",
      headline: `Recital absoluto de ${playerName} (${rating} R2.0) en el triunfo de ${playerTeam}`,
      body: `${playerName} convirtió ${label} en su patio de juegos ante ${oppTeam}. Con ${acs} ACS y un contundente ${kda} jugando ${playerRole}, lideró la victoria ${scoreTxt} (${mapsLine}) imponiendo ritmo en cada ronda armada. Sus lecturas en situaciones de desventaja cerraron cualquier intento de remontada rival.`,
      quote: `"Cuando ${playerName} entra en esta zona, da igual el veto o la economía: te rompe el mapa solo." — Caster Desk`,
      teams: [playerTeam, oppTeam],
      hot: parseFloat(rating) >= 1.5
    },
    {
      cat: "OFICIAL",
      source: "SPIKE.GG ANÁLISIS",
      headline: `${playerName} firma una tarjeta de élite (${acs} ACS) para guiar a ${playerTeam}`,
      body: `En un cruce exigente de ${label}, ${playerTeam} se apoyó en el estado de gracia de ${playerName} para imponerse ${scoreTxt} sobre ${oppTeam} (${mapsLine}). Su ${rating} de Rating 2.0 y registro de ${kda} lo colocan desde ya en la conversación por el MVP del split.`,
      quote: `"Impacto constante en primera sangre y cero errores en post-plant; una serie de manual." — Informe Técnico`,
      teams: [playerTeam, oppTeam],
      hot: parseFloat(rating) >= 1.5
    }
  ]);
}

export function buildMatchThrillerNews(params: {
  winner: string;
  loser: string;
  scoreTxt: string;
  label: string;
  mapsLine: string;
  mvpName?: string;
  mvpRating?: string;
  isInternational: boolean;
}): NewsDraft {
  const { winner, loser, scoreTxt, label, mapsLine, mvpName, mvpRating, isInternational } = params;
  const mvpTxt = mvpName ? ` con ${mvpName} (${mvpRating} R2.0) decisivo en el mapa definitivo` : "";

  return {
    cat: "OFICIAL",
    source: isInternational ? "COBERTURA LAN VCT" : "VLR.GG CRÓNICA",
    headline: `Serie de infarto: ${winner} sobrevive al límite ante ${loser} (${scoreTxt})`,
    body: `${winner} y ${loser} ofrecieron uno de los choques más tensos de ${label}, llevando la serie hasta el mapa decisivo (${mapsLine}). La sangre fría en los últimos compases inclinó la balanza hacia ${winner}${mvpTxt}. Ambos conjuntos dejaron muestras de alto nivel táctico, aunque los detalles en las rondas de bonificación marcaron la diferencia final.`,
    quote: `"Esta clase de series al límite son las que curten a un equipo de cara a playoffs y LAN." — Mesa VCT`,
    teams: [winner, loser],
    hot: isInternational
  };
}

export function buildTransferNews(params: {
  playerName: string;
  playerRole: string;
  playerOvr: number;
  playerAge: number;
  buyerName: string;
  sellerName: string;
  cash: number;
  cashFormatted: string;
  swapPlayer?: string;
  sellOnPct: number;
}): NewsDraft {
  const {
    playerName,
    playerRole,
    playerOvr,
    playerAge,
    buyerName,
    sellerName,
    cash,
    cashFormatted,
    swapPlayer,
    sellOnPct
  } = params;

  const isBlockbuster = cash >= 140000 || playerOvr >= 89;
  const swapTxt = swapPlayer
    ? ` La operación incluyó además el pase de ${swapPlayer} rumbo a ${sellerName} como pieza de intercambio.`
    : "";
  const sellTxt =
    sellOnPct > 0
      ? ` ${sellerName} se aseguró también un ${sellOnPct}% de cualquier futura venta para proteger su inversión.`
      : "";

  if (isBlockbuster) {
    return {
      cat: "OFICIAL",
      source: "MERCADO VCT · BOMBAZO",
      headline: `BOMBAZO OFICIAL: ${buyerName} rompe el mercado por ${playerName} (${cashFormatted})`,
      body: `Se confirmó el traspaso más comentado de la ventana. ${buyerName} desembolsó ${cashFormatted} para sacar a ${playerName} (${playerRole}, ${playerAge} años, OVR ${playerOvr}) de las filas de ${sellerName}.${swapTxt}${sellTxt} Con este golpe de autoridad sobre la mesa, ${buyerName} eleva su techo competitivo de inmediato y envía un mensaje directo al resto de la liga.`,
      quote: `"Cuando tienes la oportunidad de firmar a un perfil de ${playerOvr} OVR, no dudas: reorganizas el proyecto a su alrededor." — Insider de Mercado`,
      teams: [buyerName, sellerName],
      hot: true
    };
  }

  return {
    cat: "OFICIAL",
    source: "DESPACHO DE FICHAJES",
    headline: `OFICIAL: ${playerName} deja ${sellerName} y refuerza a ${buyerName} (${cashFormatted})`,
    body: `${buyerName} cerró la incorporación de ${playerName} (${playerRole}, ${playerAge} años, OVR ${playerOvr}) procedente de ${sellerName} a cambio de ${cashFormatted}.${swapTxt}${sellTxt} Desde el entorno del club comprador aseguran que su perfil encaja con las necesidades tácticas del map pool actual.`,
    teams: [buyerName, sellerName],
    hot: false
  };
}

export function buildTitleNews(params: {
  teamName: string;
  titleLabel: string;
  prizeFormatted: string;
  coachName: string;
  tier: "regional" | "masters" | "champions";
}): NewsDraft {
  const { teamName, titleLabel, prizeFormatted, coachName, tier } = params;
  const scopeText =
    tier === "champions"
      ? "la cima absoluta del VALORANT mundial"
      : tier === "masters"
        ? "un escenario internacional LAN frente a los mejores del planeta"
        : "su región tras dominar la fase decisiva";

  return {
    cat: "OFICIAL",
    source: tier === "champions" ? "ESPECIAL CHAMPIONS" : "DESPACHO OFICIAL VCT",
    headline: `${teamName.toUpperCase()} LEVANTA EL TROFEO DE ${titleLabel.toUpperCase()}`,
    body: `Campaña para el recuerdo. ${teamName} conquistó ${scopeText} al coronarse en ${titleLabel}, asegurando un premio de ${prizeFormatted} y un impulso decisivo en prestigio deportivo. El planteamiento de DT ${coachName} y la templanza del quinteto en los momentos calientes terminaron imponiendo su ley. Los patrocinadores y clubes del circuito ya miran de cerca al cuerpo técnico campeón.`,
    quote: `"No ganaron por casualidad: dominaron el veto, los tiempos de rotación y la presión del escenario." — Crónica de Cierre`,
    teams: [teamName],
    hot: true
  };
}

export function buildObjectiveCompletedNews(params: {
  teamName: string;
  tierLabel: string;
  objectiveLabel: string;
  bonusFormatted: string;
  repGain: number;
  early: boolean;
}): NewsDraft {
  const { teamName, tierLabel, objectiveLabel, bonusFormatted, repGain, early } = params;
  return {
    cat: "OFICIAL",
    source: "DIRECTIVA & NEGOCIOS",
    headline: early
      ? `${teamName} cumple su objetivo antes de tiempo y libera bono de ${bonusFormatted}`
      : `${teamName} cierra el objetivo anual y recibe respaldo total de la directiva`,
    body: `La cúpula de ${teamName} (exigencia ${tierLabel}) dio por cumplida la misión de temporada: ${objectiveLabel}. En reconocimiento a la gestión, el club desbloqueó una inyección extra de ${bonusFormatted} para reforzar la plantilla y la reputación del manager escaló +${repGain} puntos en el circuito internacional.`,
    quote: `"Cumplir la hoja de ruta con este margen te abre las puertas de las mejores franquicias del ecosistema VCT." — Analista de Gestión`,
    teams: [teamName],
    hot: true
  };
}

export function buildObjectiveRiskNews(params: {
  teamName: string;
  eventLabel: string;
  boardConfidence: number;
}): NewsDraft {
  const { teamName, eventLabel, boardConfidence } = params;
  return {
    cat: "DRAMA",
    source: "VLR.GG INSIDER",
    headline: `Alarma en ${teamName}: quedarse fuera de ${eventLabel} golpea a la directiva`,
    body: `La ausencia de ${teamName} en ${eventLabel} cayó como un balde de agua fría en las oficinas del club. Con la confianza directiva cayendo a ${boardConfidence > 0 ? "+" : ""}${boardConfidence}, el proyecto entra en zona de alerta y se queda casi sin red de seguridad para el resto del calendario. El entorno del equipo exige una reacción inmediata para evitar una reunión de emergencia al cierre del Stage 2.`,
    quote: `"Para un contendiente, ver un internacional desde casa duele el doble: en puntos VCT y en credibilidad." — Tertulia VCT`,
    teams: [teamName],
    hot: true
  };
}

export function buildBoardMeetingNews(params: {
  teamName: string;
  outcome: "survived" | "fired" | "resigned";
  reason: string;
  giantNoTitle?: boolean;
}): NewsDraft {
  const { teamName, outcome, reason, giantNoTitle } = params;

  if (outcome === "fired") {
    return {
      cat: "DRAMA",
      source: "ÚLTIMA HORA VCT",
      headline: `TERREMOTO EN ${teamName.toUpperCase()}: la directiva destituye al manager`,
      body: giantNoTitle
        ? `La junta directiva de ${teamName} cumplió su amenaza y ejecutó el despido tras cerrar el año sin títulos oficiales (${reason}). Ni el balance de victorias ni los tramos de buen juego bastaron para frenar la decisión en un club obligado a ganar trofeos cada temporada.`
        : `Tras una tensa reunión de evaluación a puerta cerrada, la directiva de ${teamName} decidió dar por terminado el ciclo del manager luego de no cumplir el objetivo pactado (${reason}). El club ya sondea el mercado mientras varias organizaciones menores tantean al técnico saliente.`,
      quote: `"En la franquicia la paciencia se agotó: cuando el objetivo se escapa, el primero en pagar es el banquillo." — VLR Insider`,
      teams: [teamName],
      hot: true
    };
  }

  if (outcome === "resigned") {
    return {
      cat: "OFICIAL",
      source: "COMUNICADO OFICIAL",
      headline: `Salida pactada: el manager presenta su renuncia en ${teamName}`,
      body: `Antes de someterse al desgaste de un cese formal tras no alcanzar la meta fijada (${reason}), el manager de ${teamName} dio un paso al costado de mutuo acuerdo. La salida ordenada mantiene su perfil atractivo para clubes que buscan iniciar un nuevo proyecto deportivo.`,
      teams: [teamName],
      hot: true
    };
  }

  return {
    cat: "DRAMA",
    source: "VLR.GG INSIDER",
    headline: `Voto de confianza bajo ultimátum: ${teamName} ratifica a su manager tras tensa cumbre`,
    body: `Pese a incumplir la meta prevista (${reason}), la cúpula de ${teamName} decidió sostener al cuerpo técnico luego de una reunión decisiva. Sin embargo, fuentes internas confirman que el margen de error desapareció por completo: cualquier tropiezo prolongado a partir de ahora desencadenará un cambio inmediato.`,
    quote: `"Salvó el puesto en la mesa, pero ahora le toca responder en el servidor desde la próxima semana." — Columnista VCT`,
    teams: [teamName],
    hot: true
  };
}

export function buildWeeklyRumorNews(params: {
  buyer: string;
  seller?: string;
  playerName: string;
  playerRole: string;
  playerOvr: number;
  playerAge: number;
  contractYears?: number;
  buyerBudgetFormatted: string;
  isFreeAgent: boolean;
}): NewsDraft {
  const {
    buyer,
    seller,
    playerName,
    playerRole,
    playerOvr,
    playerAge,
    contractYears,
    buyerBudgetFormatted,
    isFreeAgent
  } = params;

  if (isFreeAgent) {
    return pick<NewsDraft>([
      {
        cat: "RUMOR",
        source: "SCRIM LEAKS",
        headline: `Avistado en scrims: ${buyer} prueba al agente libre ${playerName}`,
        body: `Varios servidores privados delatan movimientos en ${buyer}. El agente libre ${playerName} (${playerRole}, ${playerAge} años, OVR ${playerOvr}) fue visto compartiendo bloque de práctica con el núcleo del equipo durante los últimos días. Con ${buyerBudgetFormatted} disponibles en caja, el fichaje podría cerrarse en cualquier momento si las sensaciones convencen al staff.`,
        quote: `"No es una prueba casual; ${buyer} lleva semanas buscando exactamente ese perfil de ${playerRole}." — Scrim Tracker`,
        teams: [buyer],
        hot: playerOvr >= 90
      },
      {
        cat: "RUMOR",
        source: "VLR.GG INSIDER",
        headline: `${buyer} acelera contactos por ${playerName} antes de que otros clubes pujen`,
        body: `El nombre de ${playerName} (OVR ${playerOvr}, libre en el mercado) ha ganado fuerza en las oficinas de ${buyer}. Fuentes cercanas al representante aseguran que ya hubo una primera toma de contacto salarial y que el jugador ve con buenos ojos el proyecto competitivo del club.`,
        teams: [buyer],
        hot: playerOvr >= 90
      }
    ]);
  }

  const sellerName = seller || "su club";
  const contractNote =
    contractYears && contractYears <= 1
      ? ` El hecho de que entre en su último año de contrato podría abaratar la negociación.`
      : ` Sacarlo no será barato, pero ${buyer} cuenta con ${buyerBudgetFormatted} en caja para tentar a la directiva rival.`;

  return pick<NewsDraft>([
    {
      cat: "RUMOR",
      source: "VLR.GG INSIDER",
      headline: `Fuentes: ${buyer} tantea el terreno por ${playerName} (${sellerName})`,
      body: `Diversos insiders de la escena reportan llamadas exploratorias desde ${buyer} para conocer la situación contractual de ${playerName} (${playerRole}, OVR ${playerOvr}).${contractNote} Por ahora ${sellerName} guarda silencio, aunque el interés ya desató especulación entre los aficionados.`,
      quote: `"Si ${buyer} presenta una cifra seria con porcentaje de futura venta, ${sellerName} al menos se sentará a escuchar." — Reporte de Mercado`,
      teams: [buyer, sellerName],
      hot: playerOvr >= 90
    },
    {
      cat: "RUMOR",
      source: "RADAR DE FICHAJES",
      headline: `${playerName}, el nombre subrayado en la agenda de ${buyer}`,
      body: `Tras analizar las carencias del equipo en las últimas jornadas, el departamento deportivo de ${buyer} situó a ${playerName} (${playerAge} años, OVR ${playerOvr}) como prioridad de mercado.${contractNote} Todo dependerá de si ${sellerName} está dispuesto a desprenderse de una de sus piezas en medio del calendario.`,
      teams: [buyer, sellerName],
      hot: false
    },
    {
      cat: "RUMOR",
      source: "FORO VLR",
      headline: `Crece el ruido: analistas vinculan a ${playerName} con un salto a ${buyer}`,
      body: `Una serie de entrenamientos cruzados y comentarios en stream bastaron para encender el mercado. En la comunidad se da por hecho que ${buyer} estudia una ofensiva por ${playerName} (${sellerName}) para reforzar el rol de ${playerRole} de cara a los tramos decisivos.`,
      teams: [buyer, sellerName],
      hot: false
    }
  ]);
}

export function buildWeeklyDramaNews(params: {
  type: "unhappy_player" | "losing_streak" | "coach_debate" | "secret_strats" | "staff_rumor" | "academy_hype";
  clubName: string;
  coachName: string;
  playerName?: string;
  playerMorale?: number;
  playerPot?: number;
  lossStreak?: number;
  boardConfidence?: number;
  activeMapsSample?: string;
}): NewsDraft {
  const {
    type,
    clubName,
    coachName,
    playerName,
    playerMorale,
    playerPot,
    lossStreak,
    boardConfidence,
    activeMapsSample
  } = params;

  if (type === "unhappy_player" && playerName) {
    return {
      cat: "DRAMA",
      source: "VESTUARIO FILTRADO",
      headline: `Tensión interna en ${clubName}: ${playerName} medita forzar su salida`,
      body: `El ambiente en el servidor de prácticas de ${clubName} atraviesa su punto más delicado. Fuentes próximas al roster filtran que ${playerName} (Moral ${playerMorale ?? 40}) no está conforme con su situación actual y ya deslizó a su entorno la posibilidad de escuchar ofertas. Si la gestión del vestuario no calma las aguas pronto, la fractura podría trasladarse a los partidos oficiales.`,
      quote: `"Cuando un jugador clave desconecta anímicamente, las comms se apagan en la primera ronda que se tuerce." — Ex-pro Analista`,
      teams: [clubName],
      hot: true
    };
  }

  if (type === "losing_streak") {
    return {
      cat: "DRAMA",
      source: "TERTULIA VCT",
      headline: `Crisis de resultados en ${clubName}: ${lossStreak} derrotas seguidas encienden las alarmas`,
      body: `La mala racha de ${clubName} (${lossStreak} caídas al hilo) abrió un debate feroz sobre la dirección deportiva del club. Con la confianza de la junta en ${boardConfidence ?? 0}, comentaristas y aficionados cuestionan tanto el veto de mapas como la falta de reacción en los mid-rounds. La próxima semana aparece marcada en rojo en el calendario.`,
      quote: `"Perder puede pasar, pero encadenar ${lossStreak} derrotas así deja señales preocupantes de desgaste táctico." — Panel Post-Jornada`,
      teams: [clubName],
      hot: true
    };
  }

  if (type === "academy_hype" && playerName) {
    return {
      cat: "OFICIAL",
      source: "SCOUTING CANTERA",
      headline: `Foco sobre la joya de ${clubName}: ${playerName} impresiona en entrenamientos`,
      body: `Varios ojeadores regionales destacan el salto de madurez de ${playerName} (POT ${playerPot ?? 90}) dentro del primer equipo de ${clubName}. Con hambre competitiva y nulo miedo escénico, el juvenil formado en cantera empieza a ganarse el respeto de rivales consolidados en el circuito.`,
      quote: `"Juega los duelos con la soltura de alguien que lleva tres temporadas en franquicia." — Scouting VCT`,
      teams: [clubName],
      hot: false
    };
  }

  if (type === "coach_debate") {
    return {
      cat: "DRAMA",
      source: "SPIKE.GG ANÁLISIS",
      headline: `Debate táctico: cuestionan las composiciones de DT ${coachName} en ${clubName}`,
      body: `Varios creadores de contenido táctico pusieron bajo la lupa los últimos drafts de ${clubName} en mapas como ${activeMapsSample || "el pool actual"}. Aunque DT ${coachName} defiende su apuesta por sinergias agresivas, críticos señalan que el equipo sacrifica demasiada estabilidad defensiva cuando la economía aprieta.`,
      quote: `"Es valiente salirse del meta, pero si no cierras la primera mitad con ventaja, esas comps se desangran." — Análisis VOD`,
      teams: [clubName],
      hot: false
    };
  }

  if (type === "secret_strats") {
    return {
      cat: "RUMOR",
      source: "SCRIM LEAKS",
      headline: `${clubName} blinda sus entrenamientos: DT ${coachName} prepara setups inéditos`,
      body: `Equipos rivales confirman que ${clubName} redujo drásticamente sus scrims abiertos para trabajar a puerta cerrada bajo las órdenes de DT ${coachName}. Todo apunta a que guardan ejecuciones nuevas y variaciones de roles pensadas específicamente para los cruces decisivos que se avecinan.`,
      teams: [clubName],
      hot: false
    };
  }

  return {
    cat: "DRAMA",
    source: "VLR.GG INSIDER",
    headline: `Rumores en los despachos de ${clubName}: observan el mercado de Head Coaches`,
    body: `Aunque no existe una ruptura oficial con DT ${coachName}, fuentes de la industria señalan que la directiva de ${clubName} ha pedido informes sobre varios entrenadores promesa y técnicos libres del circuito. Un tramo irregular en las próximas semanas podría acelerar decisiones en el staff.`,
    teams: [clubName],
    hot: false
  };
}

export function buildMapPoolNews(params: {
  season: number;
  outMaps: string[];
  inMaps: string[];
  activePool: string[];
  isManual?: boolean;
}): NewsDraft {
  const { season, outMaps, inMaps, activePool, isManual } = params;
  return {
    cat: "OFICIAL",
    source: "DESPACHO OFICIAL VCT",
    headline: isManual
      ? `Sacudida táctica: entran ${inMaps.join(" y ")} al Map Pool activo`
      : `VCT ${season}: Riot oficializa rotación de mapas (${inMaps.join(" y ")} adentro)`,
    body: `El circuito competitivo cambia de piel. Salen de la rotación ${outMaps.join(" y ")} para dar entrada a ${inMaps.join(" y ")}, configurando el nuevo pool oficial de 7 mapas: ${activePool.join(", ")}. Los cuerpos técnicos ya trabajan a contrarreloj en nuevas composiciones y prioridades de veto.`,
    quote: `"Cada rotación de dos mapas premia a los clubes con mejor cuerpo técnico y castiga a los equipos de un solo libreto." — Panel VCT`,
    teams: [],
    hot: true
  };
}