package com.vaultor.vaultor.repository;

import com.vaultor.vaultor.model.FileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FileRepository extends JpaRepository<FileEntity, String> {
}
