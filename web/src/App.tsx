function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Varroa Mite Calculator</h1>
        <p className="app-subtitle">Project your hive's mite population over the coming year</p>
      </header>
      <main className="app-body">
        <aside className="controls-panel">
          <h2>My hive</h2>
          <h2>My measurement</h2>
          <h2>Treatment plan</h2>
        </aside>
        <section className="chart-area">
          <div className="banner-slot" />
          <div className="chart-placeholder">Chart</div>
        </section>
      </main>
    </div>
  )
}

export default App
