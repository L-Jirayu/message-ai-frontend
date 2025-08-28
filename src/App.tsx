import { Interface } from "./interface/Interface";

function App() {
  return (
    <Interface>
      <Interface.Content>
        <h1>Job Queue Dashboard</h1>

        <Interface.Box className="job-action-box">
          <h2>Job Action</h2>
          <Interface.Namebox placeholder="Enter your name" />
          <Interface.Textbox placeholder="Enter the message" />
          <Interface.Button label="Submit" type="submit" />
        </Interface.Box>

        <Interface.Box className="job-list-box">
          <Interface.JobList />
        </Interface.Box>
      </Interface.Content>
    </Interface>
  );
}

export default App;
