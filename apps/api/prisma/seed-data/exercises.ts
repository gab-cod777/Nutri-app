import type { Equipment, MuscleGroup } from '@prisma/client';

/**
 * Catalogo curado de exercicios. A IA SELECIONA daqui por canonicalName.
 *
 * Revisar com profissional de educacao fisica antes de publicar: instrucoes e
 * erros comuns sao exibidos na tela de execucao.
 */
export interface ExerciseSeed {
  canonicalName: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  requiredEquipment: Equipment[];
  isCompound: boolean;
  difficultyLevel: 1 | 2 | 3;
  instructions: string[];
  commonMistakes: string[];
}

const e = (
  canonicalName: string,
  name: string,
  primaryMuscle: MuscleGroup,
  secondaryMuscles: MuscleGroup[],
  requiredEquipment: Equipment[],
  isCompound: boolean,
  difficultyLevel: 1 | 2 | 3,
  instructions: string[],
  commonMistakes: string[],
): ExerciseSeed => ({
  canonicalName,
  name,
  primaryMuscle,
  secondaryMuscles,
  requiredEquipment,
  isCompound,
  difficultyLevel,
  instructions,
  commonMistakes,
});

export const EXERCISES: ExerciseSeed[] = [
  // Peito
  e('barbell_bench_press', 'Supino reto com barra', 'chest', ['triceps', 'shoulders'], ['barbell', 'bench'], true, 2,
    ['Deite no banco com os olhos abaixo da barra.', 'Desca a barra ate a linha do peito com cotovelos a ~45 graus.', 'Empurre ate estender os bracos sem travar os cotovelos.'],
    ['Quicar a barra no peito.', 'Tirar o quadril do banco.']),
  e('dumbbell_bench_press', 'Supino reto com halteres', 'chest', ['triceps', 'shoulders'], ['dumbbells', 'bench'], true, 1,
    ['Deite no banco com um halter em cada mao na altura do peito.', 'Empurre os halteres para cima ate quase se tocarem.', 'Desca controlando ate alongar o peitoral.'],
    ['Descer rapido demais.', 'Abrir demais os cotovelos.']),
  e('incline_dumbbell_press', 'Supino inclinado com halteres', 'chest', ['shoulders', 'triceps'], ['dumbbells', 'bench'], true, 2,
    ['Ajuste o banco entre 30 e 45 graus.', 'Empurre os halteres acima da parte alta do peito.', 'Desca de forma controlada.'],
    ['Inclinacao alta demais, virando desenvolvimento.']),
  e('machine_chest_press', 'Supino na maquina', 'chest', ['triceps', 'shoulders'], ['machines'], true, 1,
    ['Ajuste o banco para as pegadas ficarem na linha do peito.', 'Empurre ate estender os bracos.', 'Retorne devagar.'],
    ['Deixar o peso bater na pilha entre repeticoes.']),
  e('push_up', 'Flexao de bracos', 'chest', ['triceps', 'shoulders', 'abs'], ['none'], true, 1,
    ['Maos um pouco mais abertas que os ombros.', 'Corpo alinhado da cabeca aos calcanhares.', 'Desca o peito ate perto do chao e empurre.'],
    ['Deixar o quadril cair.', 'Amplitude curta.']),
  e('cable_fly', 'Crucifixo no cabo', 'chest', ['shoulders'], ['cable_machine'], false, 2,
    ['Polias na altura dos ombros, um passo a frente.', 'Feche os bracos em arco a frente do peito.', 'Volte alongando o peitoral.'],
    ['Dobrar e esticar os cotovelos durante o movimento.']),
  // Costas
  e('lat_pulldown', 'Puxada frontal', 'back', ['biceps'], ['cable_machine'], true, 1,
    ['Segure a barra com pegada aberta.', 'Puxe ate a parte alta do peito levando os cotovelos para baixo.', 'Suba controlando.'],
    ['Jogar o tronco para tras para puxar.']),
  e('pull_up', 'Barra fixa', 'back', ['biceps', 'forearms'], ['pull_up_bar'], true, 3,
    ['Pendure-se com pegada pronada um pouco mais aberta que os ombros.', 'Puxe ate o queixo passar a barra.', 'Desca ate estender os bracos.'],
    ['Balancar o corpo.', 'Meia repeticao.']),
  e('seated_cable_row', 'Remada sentada no cabo', 'back', ['biceps'], ['cable_machine'], true, 1,
    ['Sente com o tronco ereto e joelhos levemente flexionados.', 'Puxe o triangulo ate o abdomen.', 'Estenda os bracos sem curvar a coluna.'],
    ['Arredondar as costas na volta.']),
  e('dumbbell_row', 'Remada unilateral com halter', 'back', ['biceps'], ['dumbbells', 'bench'], true, 1,
    ['Apoie joelho e mao no banco.', 'Puxe o halter em direcao ao quadril.', 'Desca estendendo o braco.'],
    ['Girar o tronco para subir o peso.']),
  e('barbell_row', 'Remada curvada com barra', 'back', ['biceps', 'hamstrings'], ['barbell'], true, 2,
    ['Incline o tronco a ~45 graus com coluna neutra.', 'Puxe a barra ate o abdomen.', 'Desca controlando.'],
    ['Curvar a lombar.']),
  e('machine_row', 'Remada na maquina', 'back', ['biceps'], ['machines'], true, 1,
    ['Apoie o peito no suporte.', 'Puxe as pegadas aproximando as escapulas.', 'Retorne devagar.'],
    ['Encolher os ombros.']),
  e('band_row', 'Remada com elastico', 'back', ['biceps'], ['resistance_bands'], true, 1,
    ['Prenda o elastico a frente na altura do peito.', 'Puxe levando os cotovelos para tras.', 'Volte controlando a tensao.'],
    ['Deixar o elastico puxar de volta sem controle.']),
  // Ombros
  e('dumbbell_shoulder_press', 'Desenvolvimento com halteres', 'shoulders', ['triceps'], ['dumbbells'], true, 1,
    ['Halteres na altura das orelhas.', 'Empurre acima da cabeca.', 'Desca ate a altura inicial.'],
    ['Arquear demais a lombar.']),
  e('machine_shoulder_press', 'Desenvolvimento na maquina', 'shoulders', ['triceps'], ['machines'], true, 1,
    ['Ajuste o banco para as pegadas ficarem na altura dos ombros.', 'Empurre para cima.', 'Retorne controlando.'],
    ['Amplitude curta.']),
  e('lateral_raise', 'Elevacao lateral', 'shoulders', [], ['dumbbells'], false, 1,
    ['Em pe, halteres ao lado do corpo.', 'Eleve os bracos lateralmente ate a altura dos ombros.', 'Desca devagar.'],
    ['Usar impulso do tronco.']),
  e('pike_push_up', 'Flexao pike', 'shoulders', ['triceps'], ['none'], true, 2,
    ['Quadril alto formando um V invertido.', 'Flexione os cotovelos levando a cabeca em direcao ao chao.', 'Empurre de volta.'],
    ['Descer o quadril durante o movimento.']),
  // Bracos
  e('dumbbell_curl', 'Rosca direta com halteres', 'biceps', ['forearms'], ['dumbbells'], false, 1,
    ['Em pe, halteres ao lado do corpo.', 'Flexione os cotovelos ate os ombros.', 'Desca devagar.'],
    ['Balancar o tronco.']),
  e('cable_curl', 'Rosca no cabo', 'biceps', ['forearms'], ['cable_machine'], false, 1,
    ['Polia baixa, barra reta.', 'Flexione os cotovelos mantendo-os junto ao corpo.', 'Estenda controlando.'],
    ['Afastar os cotovelos do corpo.']),
  e('triceps_pushdown', 'Triceps na polia', 'triceps', [], ['cable_machine'], false, 1,
    ['Polia alta, cotovelos junto ao corpo.', 'Estenda os cotovelos ate o fim.', 'Volte ate 90 graus.'],
    ['Mover os ombros junto.']),
  e('overhead_dumbbell_extension', 'Triceps frances com halter', 'triceps', [], ['dumbbells'], false, 1,
    ['Segure um halter acima da cabeca com as duas maos.', 'Desca atras da cabeca flexionando os cotovelos.', 'Estenda de volta.'],
    ['Abrir os cotovelos.']),
  e('bench_dip', 'Mergulho no banco', 'triceps', ['chest', 'shoulders'], ['bench'], true, 1,
    ['Maos no banco atras do corpo.', 'Desca flexionando os cotovelos ate ~90 graus.', 'Empurre de volta.'],
    ['Descer demais forcando o ombro.']),
  // Pernas
  e('barbell_back_squat', 'Agachamento livre com barra', 'quads', ['glutes', 'hamstrings', 'abs'], ['barbell'], true, 3,
    ['Barra apoiada no trapezio, pes na largura dos ombros.', 'Agache levando o quadril para tras e para baixo.', 'Suba empurrando o chao.'],
    ['Joelhos colapsando para dentro.', 'Perder a coluna neutra.']),
  e('goblet_squat', 'Agachamento goblet', 'quads', ['glutes', 'abs'], ['dumbbells'], true, 1,
    ['Segure um halter junto ao peito.', 'Agache mantendo o tronco ereto.', 'Suba empurrando o chao.'],
    ['Tirar os calcanhares do chao.']),
  e('bodyweight_squat', 'Agachamento livre (peso corporal)', 'quads', ['glutes'], ['none'], true, 1,
    ['Pes na largura dos ombros.', 'Agache ate as coxas ficarem paralelas ao chao.', 'Suba estendendo quadril e joelhos.'],
    ['Joelhos para dentro.']),
  e('leg_press', 'Leg press', 'quads', ['glutes', 'hamstrings'], ['machines'], true, 1,
    ['Pes na plataforma na largura do quadril.', 'Desca ate ~90 graus nos joelhos.', 'Empurre sem travar os joelhos.'],
    ['Tirar o quadril do banco no fim da descida.']),
  e('leg_extension', 'Cadeira extensora', 'quads', [], ['machines'], false, 1,
    ['Ajuste o rolo acima dos tornozelos.', 'Estenda os joelhos.', 'Desca controlando.'],
    ['Usar impulso.']),
  e('lying_leg_curl', 'Mesa flexora', 'hamstrings', ['calves'], ['machines'], false, 1,
    ['Deite de brucos com o rolo acima dos calcanhares.', 'Flexione os joelhos.', 'Estenda devagar.'],
    ['Tirar o quadril do banco.']),
  e('romanian_deadlift', 'Levantamento terra romeno', 'hamstrings', ['glutes', 'back'], ['barbell'], true, 2,
    ['Barra a frente das coxas, joelhos levemente flexionados.', 'Leve o quadril para tras descendo a barra rente as pernas.', 'Volte contraindo gluteos.'],
    ['Arredondar a lombar.']),
  e('dumbbell_romanian_deadlift', 'Terra romeno com halteres', 'hamstrings', ['glutes'], ['dumbbells'], true, 1,
    ['Halteres a frente das coxas.', 'Leve o quadril para tras com a coluna neutra.', 'Volte contraindo gluteos.'],
    ['Flexionar demais os joelhos.']),
  e('walking_lunge', 'Afundo caminhando', 'quads', ['glutes', 'hamstrings'], ['none'], true, 2,
    ['De um passo longo a frente.', 'Desca o joelho de tras perto do chao.', 'Avance com a outra perna.'],
    ['Joelho da frente passar muito da ponta do pe com o calcanhar saindo do chao.']),
  e('hip_thrust', 'Elevacao pelvica', 'glutes', ['hamstrings'], ['barbell', 'bench'], true, 2,
    ['Costas apoiadas no banco, barra sobre o quadril.', 'Eleve o quadril ate alinhar com o tronco.', 'Desca controlando.'],
    ['Hiperestender a lombar no topo.']),
  e('glute_bridge', 'Ponte de gluteos', 'glutes', ['hamstrings'], ['none'], false, 1,
    ['Deitado, joelhos flexionados, pes no chao.', 'Eleve o quadril contraindo os gluteos.', 'Desca devagar.'],
    ['Empurrar com a lombar.']),
  e('standing_calf_raise', 'Panturrilha em pe', 'calves', [], ['none'], false, 1,
    ['Em pe, ponta dos pes num degrau.', 'Suba na ponta dos pes.', 'Desca alongando a panturrilha.'],
    ['Amplitude curta.']),
  // Core
  e('plank', 'Prancha', 'abs', ['shoulders'], ['none'], false, 1,
    ['Apoie antebracos e pontas dos pes.', 'Mantenha o corpo alinhado.', 'Contraia abdomen e gluteos.'],
    ['Deixar o quadril cair ou subir demais.']),
  e('crunch', 'Abdominal supra', 'abs', [], ['none'], false, 1,
    ['Deitado, joelhos flexionados.', 'Eleve os ombros do chao contraindo o abdomen.', 'Desca devagar.'],
    ['Puxar o pescoco com as maos.']),
  e('hanging_knee_raise', 'Elevacao de joelhos na barra', 'abs', ['forearms'], ['pull_up_bar'], false, 2,
    ['Pendure-se na barra.', 'Eleve os joelhos em direcao ao peito.', 'Desca sem balancar.'],
    ['Usar balanco do corpo.']),
  // Cardio
  e('treadmill_walk', 'Caminhada na esteira', 'cardio', [], ['cardio_machine'], false, 1,
    ['Ajuste velocidade para conseguir conversar com algum esforco.', 'Mantenha postura ereta.', 'Use inclinacao para aumentar a intensidade.'],
    ['Segurar no apoio o tempo todo.']),
  e('kettlebell_swing', 'Swing com kettlebell', 'glutes', ['hamstrings', 'back', 'cardio'], ['kettlebell'], true, 2,
    ['Kettlebell entre as pernas, quadril para tras.', 'Projete o quadril a frente levando o peso ate a altura do peito.', 'Deixe descer e repita.'],
    ['Levantar com os bracos em vez do quadril.']),
];
