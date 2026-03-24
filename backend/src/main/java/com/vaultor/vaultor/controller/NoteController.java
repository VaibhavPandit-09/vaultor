package com.vaultor.vaultor.controller;

import com.vaultor.vaultor.model.Note;
import com.vaultor.vaultor.repository.NoteRepository;
import com.vaultor.vaultor.repository.FileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {
    private final NoteRepository noteRepository;
    private final FileRepository fileRepository;

    @PostMapping
    public Note createNote(@RequestBody Note note) {
        return noteRepository.save(note);
    }

    @GetMapping
    public List<Object> getAllNotes() { // Returns preview
        return noteRepository.findAll().stream().map(n -> {
            String preview = n.getContent() != null && n.getContent().length() > 50 
                ? n.getContent().substring(0, 50) + "..." : n.getContent();
            return java.util.Map.of(
                "id", n.getId(),
                "title", n.getTitle(),
                "preview", preview,
                "updatedAt", n.getUpdatedAt()
            );
        }).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Object> getNote(@PathVariable String id) {
        return noteRepository.findById(id).map(n -> {
            List<Object> mappedFiles = n.getFiles().stream().map(f -> 
                java.util.Map.of("id", f.getId(), "name", f.getOriginalName())
            ).collect(Collectors.toList());
            
            return ResponseEntity.ok((Object) java.util.Map.of(
                "id", n.getId(),
                "title", n.getTitle(),
                "content", n.getContent(),
                "createdAt", n.getCreatedAt(),
                "updatedAt", n.getUpdatedAt(),
                "files", mappedFiles
            ));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Note> updateNote(@PathVariable String id, @RequestBody Note noteUpdates) {
        return noteRepository.findById(id).map(n -> {
            n.setTitle(noteUpdates.getTitle());
            n.setContent(noteUpdates.getContent());
            return ResponseEntity.ok(noteRepository.save(n));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable String id) {
        if (noteRepository.existsById(id)) {
            noteRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
    
    @PostMapping("/{noteId}/files/{fileId}")
    public ResponseEntity<Note> attachFile(@PathVariable String noteId, @PathVariable String fileId) {
        return noteRepository.findById(noteId).flatMap(n -> 
            fileRepository.findById(fileId).map(f -> {
                n.getFiles().add(f);
                return ResponseEntity.ok(noteRepository.save(n));
            })
        ).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{noteId}/files/{fileId}")
    public ResponseEntity<Note> detachFile(@PathVariable String noteId, @PathVariable String fileId) {
        return noteRepository.findById(noteId).map(n -> {
            n.getFiles().removeIf(f -> f.getId().equals(fileId));
            return ResponseEntity.ok(noteRepository.save(n));
        }).orElse(ResponseEntity.notFound().build());
    }
}
