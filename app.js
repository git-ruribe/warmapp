/**
 * CALIENTAPP - Aplicación para guiar rutinas de calentamiento
 * Versión: 0.1.0
 */

// ===== CARGA DE RUTINA DE EJERCICIOS =====
let workoutRoutine;

// Cargar la rutina de ejercicios desde el archivo JSON
async function loadWorkoutRoutine() {
  try {
    const response = await fetch('workout-routine.json');
    const routineData = await response.json();
    workoutRoutine = routineData.sections;
    return workoutRoutine;
  } catch (error) {
    console.error('Error cargando la rutina de ejercicios:', error);
    showToast('No se pudo cargar la rutina de ejercicios', 'error');
    return null;
  }
}

// ===== MÓDULO DE GESTIÓN DEL ESTADO DE LA APLICACIÓN =====

const AppState = {
  // Estado actual de la sesión
  currentSession: {
    active: false,
    startTime: null,
    endTime: null,
    currentExerciseIndex: 0,
    currentSectionIndex: 0,
    exerciseStartTime: null,
    exerciseTimes: [],
    paused: false,
    pauseStartTime: null,
    totalPausedTime: 0
  },
  
  // Datos de usuario y configuración
  userData: {
    exerciseTimings: {}, // Almacena tiempos promedios por ejercicio
    streak: 0,
    lastWorkoutDate: null,
    history: [] // Historial de sesiones
  },
  
  // Inicializar estado
  async init() {
    // Cargar rutina de ejercicios
    await loadWorkoutRoutine();
    
    this.loadUserData();
    this.updateStreak();
    return this;
  },
  
  // Cargar datos de usuario desde localStorage
  loadUserData() {
    const savedData = localStorage.getItem('calientapp_userData');
    if (savedData) {
      try {
        this.userData = JSON.parse(savedData);
        // Asegurarse de que todos los campos existan
        if (!this.userData.exerciseTimings) this.userData.exerciseTimings = {};
        if (!this.userData.streak) this.userData.streak = 0;
        if (!this.userData.history) this.userData.history = [];
      } catch (e) {
        console.error('Error al cargar datos de usuario:', e);
        this.userData = {
          exerciseTimings: {},
          streak: 0,
          lastWorkoutDate: null,
          history: []
        };
      }
    }
  },
  
  // Obtener ejercicio actual
  getCurrentExercise() {
    if (!this.currentSession.active) return null;
    
    const { currentSectionIndex, currentExerciseIndex } = this.currentSession;
    
    // Verificar si hemos llegado al final
    if (currentSectionIndex >= workoutRoutine.length) {
      return null;
    }
    
    const section = workoutRoutine[currentSectionIndex];
    
    // Verificar si hemos llegado al final de la sección
    if (currentExerciseIndex >= section.exercises.length) {
      return null;
    }
    
    const exercise = section.exercises[currentExerciseIndex];
    
    return {
      ...exercise,
      sectionName: section.name,
      position: {
        exercise: currentExerciseIndex + 1,
        totalExercises: section.exercises.length,
        section: currentSectionIndex + 1,
        totalSections: workoutRoutine.length
      }
    };
  },
  
  // Pasar al siguiente ejercicio
  nextExercise() {
    if (!this.currentSession.active) return null;
    
    // Guardar tiempo del ejercicio actual
    const exerciseEndTime = new Date();
    const currentSectionIndex = this.currentSession.currentSectionIndex;
    const currentExIndex = this.currentSession.currentExerciseIndex;
    
    // Calcular tiempo efectivo (excluyendo pausas)
    const effectiveTime = exerciseEndTime - this.currentSession.exerciseStartTime - this.currentSession.totalPausedTime;
    this.currentSession.exerciseTimes.push(effectiveTime);
    
    // Actualizar tiempo promedio para este ejercicio
    const currentExercise = workoutRoutine[currentSectionIndex].exercises[currentExIndex];
    this.updateExerciseTiming(currentExercise.id, effectiveTime);
    
    // Reiniciar tiempo de pausa para el siguiente ejercicio
    this.currentSession.totalPausedTime = 0;
    
    // Actualizar índices
    this.currentSession.currentExerciseIndex++;
    
    // Si ya terminamos todos los ejercicios de esta sección, pasar a la siguiente
    if (this.currentSession.currentExerciseIndex >= workoutRoutine[currentSectionIndex].exercises.length) {
      this.currentSession.currentSectionIndex++;
      this.currentSession.currentExerciseIndex = 0;
      
      // Si ya terminamos todas las secciones, finalizar sesión
      if (this.currentSession.currentSectionIndex >= workoutRoutine.length) {
        return this.endSession();
      }
    }
    
    // Actualizar tiempo de inicio para el nuevo ejercicio
    this.currentSession.exerciseStartTime = new Date();
    
    // Devolver el nuevo ejercicio actual
    return this.getCurrentExercise();
  },
  
  // Obtener ejercicio actual
  getCurrentExercise() {
    if (!this.currentSession.active) return null;
    
    const { currentSectionIndex, currentExerciseIndex } = this.currentSession;
    
    // Verificar si hemos llegado al final
    if (currentSectionIndex >= workoutRoutine.length) {
      return null;
    }
    
    const section = workoutRoutine[currentSectionIndex];
    
    // Verificar si hemos llegado al final de la sección
    if (currentExerciseIndex >= section.exercises.length) {
      return null;
    }
    
    return {
      ...section.exercises[currentExerciseIndex],
      sectionName: section.section,
      position: {
        exercise: currentExerciseIndex + 1,
        totalExercises: section.exercises.length,
        section: currentSectionIndex + 1,
        totalSections: workoutRoutine.length
      }
    };
  },
  
  // Actualizar tiempo promedio de un ejercicio
  updateExerciseTiming(exerciseId, time) {
    const timings = this.userData.exerciseTimings;
    
    if (!timings[exerciseId]) {
      // Primera vez que se realiza este ejercicio
      timings[exerciseId] = time;
    } else {
      // Actualizar con promedio ponderado (70% historial, 30% nueva marca)
      timings[exerciseId] = timings[exerciseId] * 0.7 + time * 0.3;
    }
    
    this.saveUserData();
  },

  // Guardar datos de usuario en localStorage
  saveUserData() {
    try {
      localStorage.setItem('calientapp_userData', JSON.stringify(this.userData));
    } catch (e) {
      console.error('Error al guardar datos de usuario:', e);
      showToast('Error al guardar tus datos. Es posible que no haya suficiente espacio en el dispositivo.', 'error');
    }
  },
  
  // Actualizar racha de días consecutivos
  updateStreak() {
    const today = new Date().toLocaleDateString();
    const lastWorkout = this.userData.lastWorkoutDate;
    
    if (!lastWorkout) return;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();
    
    // Si el último entrenamiento fue ayer, mantener la racha
    // Si fue hoy, no hacer nada (ya se incrementó)
    // Si fue antes de ayer, reiniciar la racha
    if (lastWorkout !== today && lastWorkout !== yesterdayStr) {
      this.userData.streak = 0;
      this.saveUserData();
    }
  },
  
  // Iniciar una nueva sesión de entrenamiento
  startSession() {
    this.currentSession = {
      active: true,
      startTime: new Date(),
      endTime: null,
      currentSectionIndex: 0,
      currentExerciseIndex: 0,
      exerciseStartTime: new Date(),
      exerciseTimes: [],
      paused: false,
      pauseStartTime: null,
      totalPausedTime: 0
    };
    return this.currentSession;
  },
  
  // Pausar la sesión actual
  pauseSession() {
    if (!this.currentSession.active || this.currentSession.paused) return;
    
    this.currentSession.paused = true;
    this.currentSession.pauseStartTime = new Date();
  },
  
  // Reanudar la sesión actual
  resumeSession() {
    if (!this.currentSession.active || !this.currentSession.paused) return;
    
    const pauseDuration = new Date() - this.currentSession.pauseStartTime;
    this.currentSession.totalPausedTime += pauseDuration;
    this.currentSession.paused = false;
    this.currentSession.pauseStartTime = null;
  },
  
  // Obtener tiempo esperado para un ejercicio (basado en historial o en el valor predeterminado)
  getExpectedTime(exerciseId) {
    const exercise = workoutRoutine.flat(2)
      .find(ex => ex && ex.id === exerciseId);    
    // Obtener tiempo de usuario o usar el del JSON o el predeterminado
    const userTime = this.userData.exerciseTimings[exerciseId];
    const jsonTime = exercise?.expectedTime; // Nuevo: Obtener expectedTime del JSON
    const defaultTime = 20; // Valor predeterminado en segundos

    let timeToUse;
    if (userTime) {
      timeToUse = userTime;
      console.log("Using user time:", timeToUse);
    } else if (jsonTime !== undefined) { // Nuevo: Usar tiempo del JSON si existe
      timeToUse = jsonTime * 1000; // Convertir a milisegundos
      console.log
    } else {
      timeToUse = defaultTime * 1000; // Usar valor predeterminado si no hay otro
      console.log("Using default time:", timeToUse);
    }
    
    return timeToUse;
  },

  // Finalizar la sesión actual
  endSession() {
    if (!this.currentSession.active) return null;
    
    this.currentSession.active = false;
    this.currentSession.endTime = new Date();
    
    // Crear resumen de la sesión
    const sessionSummary = {
      date: this.currentSession.startTime,
      duration: this.currentSession.endTime - this.currentSession.startTime,
      exerciseTimes: this.currentSession.exerciseTimes,
      exerciseCount: this.currentSession.exerciseTimes.length
    };
    
    // Actualizar datos de usuario
    const today = new Date().toLocaleDateString();
    const lastWorkout = this.userData.lastWorkoutDate;
    
    // Actualizar racha si es un día diferente
    if (lastWorkout !== today) {
      // Si el último entrenamiento fue ayer o este es el primero, incrementar racha
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString();
      
      if (!lastWorkout || lastWorkout === yesterdayStr) {
        this.userData.streak++;
      } else {
        // Si ha pasado más de un día, reiniciar la racha
        this.userData.streak = 1;
      }
      
      this.userData.lastWorkoutDate = today;
    }
    
    // Agregar al historial
    this.userData.history.unshift(sessionSummary);
    
    // Limitar historial a 100 entradas
    if (this.userData.history.length > 100) {
      this.userData.history = this.userData.history.slice(0, 100);
    }
    
    this.saveUserData();
    
    return sessionSummary;
  },
  
  // Obtener historial de sesiones
  getHistory() {
    return this.userData.history;
  },
  
  // Obtener estadísticas del usuario
  getStats() {
    return {
      streak: this.userData.streak,
      totalSessions: this.userData.history.length,
      lastSession: this.userData.history[0] || null
    };
  }
};

// ===== MÓDULO DE INTERFAZ DE USUARIO =====

// Elementos del DOM
const DOM = {
  screens: {
    home: document.getElementById('home-screen'),
    exercise: document.getElementById('exercise-screen'),
    history: document.getElementById('history-screen'),
    summary: document.getElementById('summary-screen')
  },
  nav: {
    home: document.getElementById('home-nav'),
    history: document.getElementById('history-nav')
  },
  home: {
    startButton: document.getElementById('start-workout-btn')
  },
  exercise: {
    title: document.getElementById('exercise-title'),
    subtitle: document.getElementById('exercise-subtitle'),
    description: document.getElementById('exercise-description'),
    image: document.getElementById('exercise-image'),
    counterValue: document.getElementById('counter-value'),
    counterLabel: document.getElementById('counter-label'),
    position: document.getElementById('exercise-position'),
    timer: document.getElementById('exercise-timer'),
    progressBar: document.getElementById('exercise-progress-bar'),
    pauseButton: document.getElementById('pause-btn'),
    nextButton: document.getElementById('next-btn')
  },
  history: {
    calendarMonth: document.getElementById('calendar-month'),
    calendarGrid: document.getElementById('calendar-grid'),
    prevMonthBtn: document.getElementById('prev-month-btn'),
    nextMonthBtn: document.getElementById('next-month-btn'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty')
  },
  summary: {
    time: document.getElementById('summary-time'),
    exercises: document.getElementById('summary-exercises'),
    streak: document.getElementById('summary-streak'),
    message: document.getElementById('summary-message'),
    homeButton: document.getElementById('home-btn'),
    restartButton: document.getElementById('restart-btn')
  },
  toastContainer: document.getElementById('toast-container')
};

// Controlador de la interfaz de usuario
const UI = {
  // Estado de la interfaz
  state: {
    activeScreen: 'home',
    calendarDate: new Date(),
    counterInterval: null,
    timerInterval: null,
    exerciseCountdown: 0
  },
  
  // Inicializar la interfaz
  init() {
    this.bindEvents();
    this.showScreen('home');
    this.updateHistoryView();
    return this;
  },
  
  // Vincular eventos de UI
  bindEvents() {
    // Navegación principal
    DOM.nav.home.addEventListener('click', () => this.showScreen('home'));
    DOM.nav.history.addEventListener('click', () => this.showScreen('history'));
    
    // Pantalla de inicio
    DOM.home.startButton.addEventListener('click', () => this.startWorkout());
    
    // Pantalla de ejercicio
    DOM.exercise.pauseButton.addEventListener('click', () => this.togglePause());
    DOM.exercise.nextButton.addEventListener('click', () => this.nextExercise());
    
    // Pantalla de historial
    DOM.history.prevMonthBtn.addEventListener('click', () => this.changeCalendarMonth(-1));
    DOM.history.nextMonthBtn.addEventListener('click', () => this.changeCalendarMonth(1));
    
    // Pantalla de resumen
    DOM.summary.homeButton.addEventListener('click', () => this.showScreen('home'));
    DOM.summary.restartButton.addEventListener('click', () => this.startWorkout());
  },
  
  // Mostrar una pantalla específica
  showScreen(screenName) {
    // Ocultar todas las pantallas
    Object.values(DOM.screens).forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Mostrar la pantalla solicitada
    DOM.screens[screenName].classList.add('active');
    
    // Actualizar navegación activa
    Object.entries(DOM.nav).forEach(([name, element]) => {
      if (name === screenName) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    });
    
    // Acciones específicas por pantalla
    if (screenName === 'history') {
      this.updateHistoryView();
    }
    
    this.state.activeScreen = screenName;
  },
  
  // Iniciar un nuevo entrenamiento
  startWorkout() {
    // Iniciar nueva sesión
    AppState.startSession();
    
    // Mostrar pantalla de ejercicio
    this.showScreen('exercise');
    
    // Establecer primer ejercicio
    const exercise = AppState.getCurrentExercise();
    this.setExercise(exercise);
    
    // Comenzar cuenta regresiva
    this.startExerciseCounter();
  },
  
  // Establecer ejercicio actual en la UI
  setExercise(exercise) {
    if (!exercise) return;
    
    // Actualizar contenido
    DOM.exercise.title.textContent = exercise.title;
    DOM.exercise.subtitle.textContent = exercise.subtitle;
    DOM.exercise.description.textContent = exercise.description;
    DOM.exercise.image.innerHTML = exercise.image;

      // Restablecer visibilidad de botones
    DOM.exercise.nextButton.style.display = 'none';
    DOM.exercise.pauseButton.style.display = 'flex';
    DOM.exercise.pauseButton.textContent = 'Pausar';
    
    // Configurar contador
    this.state.exerciseCountdown = exercise.reps;
    DOM.exercise.counterValue.textContent = exercise.reps;
    
    if (exercise.reps > 10) {
      this.state.exerciseCountdown = exercise.exerciseTypes.countType.count
      // Para ejercicios con contador de segundos (ej. "60s")
      DOM.exercise.counterLabel.textContent = 'Segundos restantes';
    } else {
      // Para ejercicios con repeticiones
      DOM.exercise.counterLabel.textContent = 'Repeticiones restantes';
    }
    
    // Actualizar posición
    const { position } = exercise;
    DOM.exercise.position.textContent = `Ejercicio ${position.exercise} de ${position.totalExercises} - Sección ${position.section} de ${position.totalSections}`;
    
    // Actualizar barra de progreso
    const overallProgress = this.calculateOverallProgress(position);
    DOM.exercise.progressBar.style.width = `${overallProgress}%`;
    
    // Reiniciar cronómetro
    // Inicializar currentStep para cada nuevo ejercicio
    this.state.currentStep = 0;
    this.resetExerciseTimer();
  },
  
  // Calcular el progreso general del entrenamiento
  calculateOverallProgress(position) {
    let totalExercises = 0;
    let completedExercises = 0;
    
    // Contar ejercicios totales y completados
    workoutRoutine.forEach((section, sectionIndex) => {
      section.exercises.forEach((_, exerciseIndex) => {
        totalExercises++;
        
        if (sectionIndex < position.section - 1) {
          completedExercises++;
        } else if (sectionIndex === position.section - 1 && exerciseIndex < position.exercise - 1) {
          completedExercises++;
        }
      });
    });
    
    return (completedExercises / totalExercises) * 100;
  },
  
  // Iniciar/reiniciar contador de ejercicio
  startExerciseCounter() {
    // Limpiar intervalo anterior si existe
    if (this.state.counterInterval) {
      clearInterval(this.state.counterInterval);
    }
    
    const exercise = AppState.getCurrentExercise();
    if (!exercise) return;
  
    // Preparar pasos del ejercicio
    const steps = exercise.steps && exercise.steps.length > 0 ? exercise.steps : [{ description: exercise.description || 'Ejercicio sin descripción' }];    
    this.state.totalSteps = steps.length;

    // Función para actualizar la descripción y el contador
    const updateStepUI = () => {
      // Verificar que el paso actual exista
      const currentStepData = steps[this.state.currentStep] || {
        description: exercise.description || 'Ejercicio sin descripción',
      };

      // Actualizar descripción
      DOM.exercise.description.textContent = currentStepData.description || exercise.description || 'Ejercicio sin descripción';

      // Determinar si el conteo es por repeticiones o por tiempo
      const isCountByTime = exercise.exerciseTypes.countType.value === 'seconds';

      // Calcular el conteo para el paso actual
      let stepCount;
      if (currentStepData.count !== undefined) {
        // Usar el conteo específico del paso si está definido
        stepCount = currentStepData.count;
      } else {
        // Calcular el conteo por paso si no está definido, dividiendo equitativamente
        stepCount = Math.round(exercise.exerciseTypes.countType.count / steps.length);
      }

      // Configurar contador
      this.state.exerciseCountdown = stepCount;
      DOM.exercise.counterValue.textContent = stepCount;

      // Actualizar etiqueta de contador según el tipo de conteo y si hay pasos
      if (steps.length > 1) {
        DOM.exercise.counterLabel.textContent = isCountByTime ? 'Segundos restantes' : 'Repeticiones restantes';
      } else {
        // Si no hay pasos, mantener la etiqueta original
        DOM.exercise.counterLabel.textContent = isCountByTime ? 'Segundos restantes' : 'Repeticiones restantes';
      }
    };

    // Inicializar paso actual
    updateStepUI();

    // Mostrar botón "Siguiente"
    DOM.exercise.nextButton.style.display = 'flex';

    this.state.counterInterval = setInterval(() => {
      // Si está en pausa, no actualizar
      if (AppState.currentSession.paused) return;

      // Decrementar contador
      this.state.exerciseCountdown--;

      // Actualizar UI
      DOM.exercise.counterValue.textContent = 
        Math.max(this.state.exerciseCountdown, 0);
      
      // Si llegamos a 0 en este paso
      if (this.state.exerciseCountdown <= 0) {
        clearInterval(this.state.counterInterval);
        //this.state.counterInterval = null;
        //this.nextExercise();        
      }
    }, exercise.exerciseTypes.countType.value === 'seconds' ? 1000 :
    (AppState.getExpectedTime(exercise.id) / (exercise.exerciseTypes.countType.count )));

    // Iniciar cronómetro
    this.startExerciseTimer();
  },
  
  // Iniciar/reiniciar cronómetro de ejercicio
  startExerciseTimer() {
    // Limpiar intervalo anterior si existe
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
    }
    
    const startTime = new Date();
    
    this.state.timerInterval = setInterval(() => {
      // Si está en pausa, no actualizar
      if (AppState.currentSession.paused) return;
      
      // Calcular tiempo transcurrido
      const elapsedTime = new Date() - startTime;
      
      // Convertir a formato mm:ss
      const minutes = Math.floor(elapsedTime / 60000);
      const seconds = Math.floor((elapsedTime % 60000) / 1000);
      
      // Actualizar UI
      DOM.exercise.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  },
  
  // Reiniciar cronómetro
  resetExerciseTimer() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
    
    DOM.exercise.timer.textContent = '00:00';
    this.startExerciseTimer();
  },
  
  // Pausa/Reanudar ejercicio actual
  togglePause() {
    if (AppState.currentSession.paused) {
      // Reanudar
      AppState.resumeSession();
      DOM.exercise.pauseButton.textContent = 'Pausar';
      this.showToast('Ejercicio reanudado', 'success');
    } else {
      // Pausar
      AppState.pauseSession();
      DOM.exercise.pauseButton.textContent = 'Reanudar';
      this.showToast('Ejercicio pausado', 'warning');
    }
  },
  
  // Pasar al siguiente ejercicio
  nextExercise() {    
    const exercise = AppState.getCurrentExercise();
  
    // Si no hay ejercicios, finalizar el entrenamiento
    if (!exercise) {
      this.showWorkoutSummary();
      return;
    }
  
    // Reiniciar el paso para el siguiente ejercicio
    this.state.currentStep = 0;    
    this.nextStepOrExercise(exercise);    
  },

  // Avanzar al siguiente paso o ejercicio
  nextStepOrExercise(exercise) {
  if (!exercise) {
    const nextExercise = AppState.nextExercise();
    if(nextExercise){
      this.setExercise(nextExercise);
      this.startExerciseCounter();
      return;
    }
    this.showWorkoutSummary();
    return;
  }

  // Si el ejercicio tiene pasos múltiples
  if (exercise.steps && exercise.steps.length > 1) {
    // Incrementar el paso actual
    this.state.currentStep++;

    // Si quedan más pasos en el mismo ejercicio
    if (this.state.currentStep < this.state.totalSteps) {      
      this.startExerciseCounter();      
    } else{
      this.state.currentStep = 0;
      const nextExercise = AppState.nextExercise();
      if(nextExercise){
        this.setExercise(nextExercise);
        this.startExerciseCounter();
        return;
      }
      this.showWorkoutSummary();
    }
  } else {
    this.nextStepOrExercise(null)
  }
},
    
  // Mostrar resumen del entrenamiento
  showWorkoutSummary() {
    const summary = AppState.currentSession.endTime 
      ? { 
          duration: AppState.currentSession.endTime - AppState.currentSession.startTime,
          exerciseCount: AppState.currentSession.exerciseTimes.length,
          streak: AppState.userData.streak
        }
      : AppState.endSession();
    
    if (!summary) return;
    
    // Formatear duración total (mm:ss)
    const minutes = Math.floor(summary.duration / 60000);
    const seconds = Math.floor((summary.duration % 60000) / 1000);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Actualizar UI
    DOM.summary.time.textContent = timeStr;
    DOM.summary.exercises.textContent = summary.exerciseCount;
    DOM.summary.streak.textContent = AppState.userData.streak;
    
    // Mensaje personalizado
    const history = AppState.getHistory();
    if (history.length > 1) {
      const lastSession = history[1]; // La sesión anterior a la actual
      const improvement = lastSession.duration > summary.duration;
      
      if (improvement) {
        const diff = Math.round((lastSession.duration - summary.duration) / lastSession.duration * 100);
        DOM.summary.message.textContent = `¡Has mejorado tu tiempo en un ${diff}% comparado con tu última sesión!`;
        DOM.summary.message.style.color = 'var(--success)';
      } else {
        DOM.summary.message.textContent = '¡Buen trabajo! Mantén la constancia para seguir mejorando.';
        DOM.summary.message.style.color = 'var(--primary)';
      }
    } else {
      DOM.summary.message.textContent = '¡Felicidades por completar tu primera sesión! ¡Sigue así!';
      DOM.summary.message.style.color = 'var(--success)';
    }
    
    // Mostrar pantalla de resumen
    this.showScreen('summary');
  },
  
  // Actualizar vista de historial
  updateHistoryView() {
    // Actualizar calendario
    this.updateCalendar();
    
    // Actualizar lista de sesiones
    this.updateHistoryList();
  },
  
  // Actualizar calendario
  updateCalendar() {
    const date = this.state.calendarDate;
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Actualizar cabecera del mes
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    DOM.history.calendarMonth.textContent = `${monthNames[month]} ${year}`;
    
    // Limpiar días anteriores (excepto cabeceras)
    const headerCells = Array.from(DOM.history.calendarGrid.querySelectorAll('.calendar-day-header'));
    DOM.history.calendarGrid.innerHTML = '';
    headerCells.forEach(cell => DOM.history.calendarGrid.appendChild(cell));
    
    // Obtener historia para marcar días con actividad
    const history = AppState.getHistory();
    const activeDays = new Set();
    
    history.forEach(session => {
      const sessionDate = new Date(session.date);
      if (sessionDate.getMonth() === month && sessionDate.getFullYear() === year) {
        activeDays.add(sessionDate.getDate());
      }
    });
    
    // Obtener el primer día del mes (0 = domingo, 1 = lunes, etc.)
    const firstDay = new Date(year, month, 1).getDay();
    
    // Calcular número de días en el mes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Añadir celdas vacías para alinear con el día de la semana
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.classList.add('calendar-day');
      DOM.history.calendarGrid.appendChild(emptyCell);
    }
    
    // Añadir días del mes
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    const currentDay = today.getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayCell = document.createElement('div');
      dayCell.classList.add('calendar-day');
      dayCell.textContent = day;
      
      // Marcar celdas activas (con sesiones)
      if (activeDays.has(day)) {
        dayCell.classList.add('active');
      }
      
      // Marcar día actual
      if (isCurrentMonth && day === currentDay) {
        dayCell.classList.add('today');
      }
      
      DOM.history.calendarGrid.appendChild(dayCell);
    }
  },
  
  // Cambiar mes del calendario
  changeCalendarMonth(delta) {
    const date = this.state.calendarDate;
    date.setMonth(date.getMonth() + delta);
    this.updateCalendar();
  },
  
  // Actualizar lista de historial
  updateHistoryList() {
    const history = AppState.getHistory();
    
    // Limpiar lista
    DOM.history.historyList.innerHTML = '';
    
    // Mostrar mensaje si no hay historial
    if (history.length === 0) {
      DOM.history.historyEmpty.style.display = 'block';
      return;
    }
    
    DOM.history.historyEmpty.style.display = 'none';
    
    // Agrupar historial por días
    const historyByDay = {};
    history.forEach(session => {
      const date = new Date(session.date).toLocaleDateString();
      if (!historyByDay[date]) {
        historyByDay[date] = [];
      }
      historyByDay[date].push(session);
    });
    
    // Crear tarjetas para cada día
    Object.entries(historyByDay).forEach(([date, sessions]) => {
      sessions.forEach(session => {
        const card = this.createHistoryCard(date, session);
        DOM.history.historyList.appendChild(card);
      });
    });
  },
  
  // Crear tarjeta de historial
  createHistoryCard(date, session) {
    const card = document.createElement('div');
    card.classList.add('history-card');
    
    // Formatear hora
    const sessionDate = new Date(session.date);
    const hours = sessionDate.getHours().toString().padStart(2, '0');
    const minutes = sessionDate.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    // Formatear duración
    const durationMinutes = Math.floor(session.duration / 60000);
    const durationSeconds = Math.floor((session.duration % 60000) / 1000);
    const durationStr = `${durationMinutes.toString().padStart(2, '0')}:${durationSeconds.toString().padStart(2, '0')}`;
    
    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-date">${date}</div>
        <div class="history-time">${timeStr}</div>
      </div>
      <div class="history-details">
        <div class="history-stats">
          <div class="history-stat">
            <div class="history-stat-value">${durationStr}</div>
            <div class="history-stat-label">Duración</div>
          </div>
          <div class="history-stat">
            <div class="history-stat-value">${session.exerciseCount}</div>
            <div class="history-stat-label">Ejercicios</div>
          </div>
        </div>
      </div>
    `;
    
    return card;
  },
  
  // Mostrar notificación toast
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.classList.add('toast', `toast-${type}`);
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
      </div>
      <button class="toast-close">×</button>
    `;
    
    // Agregar al contenedor
    DOM.toastContainer.appendChild(toast);
    
    // Agregar evento para cerrar
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });
    
    // Eliminar automáticamente después de 3 segundos
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// ===== INICIALIZACIÓN DE LA APLICACIÓN =====

// Iniciar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar estado
  AppState.init();
  
  // Inicializar UI
  UI.init();
  
  // Mostrar mensaje de bienvenida en la primera visita
  if (!localStorage.getItem('calientapp_firstVisit')) {
    localStorage.setItem('calientapp_firstVisit', 'true');
    UI.showToast('¡Bienvenido a Calientapp! Tu entrenador personal de calentamiento.', 'success');
  }
});
