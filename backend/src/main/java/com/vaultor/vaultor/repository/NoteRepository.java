package com.vaultor.vaultor.repository;

import com.vaultor.vaultor.model.Note;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoteRepository extends JpaRepository<Note, String> {
}
