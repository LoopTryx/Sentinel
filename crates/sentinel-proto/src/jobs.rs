use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InvalidTransition;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub owner_ref: String,
    pub state: JobState,
}

impl Job {
    pub fn new(id: &str, owner_ref: &str) -> Self {
        Self {
            id: id.to_owned(),
            owner_ref: owner_ref.to_owned(),
            state: JobState::Queued,
        }
    }

    pub fn start(&mut self) -> Result<(), InvalidTransition> {
        if self.state != JobState::Queued {
            return Err(InvalidTransition);
        }
        self.state = JobState::Running;
        Ok(())
    }

    pub fn complete(&mut self) -> Result<(), InvalidTransition> {
        if self.state != JobState::Running {
            return Err(InvalidTransition);
        }
        self.state = JobState::Completed;
        Ok(())
    }

    pub fn fail(&mut self) -> Result<(), InvalidTransition> {
        if self.state != JobState::Running {
            return Err(InvalidTransition);
        }
        self.state = JobState::Failed;
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<(), InvalidTransition> {
        if !matches!(self.state, JobState::Queued | JobState::Running) {
            return Err(InvalidTransition);
        }
        self.state = JobState::Cancelled;
        Ok(())
    }
}
